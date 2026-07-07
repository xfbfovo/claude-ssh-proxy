package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func OpenStore(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}
	if _, err := db.Exec(`PRAGMA journal_mode=WAL`); err != nil {
		return nil, fmt.Errorf("设置 WAL 模式失败: %w", err)
	}
	db.SetMaxOpenConns(8)

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS admin_users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS routes (
			route_user TEXT PRIMARY KEY,
			target_host TEXT NOT NULL,
			target_port INTEGER NOT NULL DEFAULT 22,
			target_user TEXT NOT NULL,
			auth_type TEXT NOT NULL,
			auth_password TEXT,
			auth_private_key TEXT,
			auth_private_key_passphrase TEXT,
			listen_password_hash TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS route_authorized_keys (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			route_user TEXT NOT NULL REFERENCES routes(route_user) ON DELETE CASCADE,
			public_key TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ts DATETIME DEFAULT CURRENT_TIMESTAMP,
			route_user TEXT,
			remote_addr TEXT,
			target_host TEXT,
			target_port INTEGER,
			event_type TEXT,
			detail TEXT,
			exit_status INTEGER,
			truncated INTEGER DEFAULT 0
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(ts)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_route_user ON audit_logs(route_user)`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("迁移失败 (%s): %w", stmt, err)
		}
	}
	return s.ensureColumn("routes", "listen_password_hash", "TEXT")
}

// ensureColumn 给已存在的旧库补列(SQLite 的 ALTER TABLE 不支持 IF NOT EXISTS)。
func (s *Store) ensureColumn(table, column, decl string) error {
	rows, err := s.db.Query(fmt.Sprintf(`PRAGMA table_info(%s)`, table))
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, ctype string
		var notNull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notNull, &dflt, &pk); err != nil {
			return err
		}
		if name == column {
			return nil // 已存在
		}
	}
	rows.Close()

	_, err = s.db.Exec(fmt.Sprintf(`ALTER TABLE %s ADD COLUMN %s %s`, table, column, decl))
	return err
}

// ---------- settings ----------

func (s *Store) GetSetting(key, def string) string {
	var v string
	err := s.db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	if err != nil {
		return def
	}
	return v
}

func (s *Store) SetSetting(key, value string) error {
	_, err := s.db.Exec(`INSERT INTO settings(key, value) VALUES(?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}

// ---------- admin users ----------

type AdminUser struct {
	ID           int64
	Username     string
	PasswordHash string
}

func (s *Store) CountAdminUsers() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM admin_users`).Scan(&n)
	return n, err
}

func (s *Store) CreateAdminUser(username, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`INSERT INTO admin_users(username, password_hash) VALUES(?, ?)`, username, string(hash))
	return err
}

func (s *Store) GetAdminUser(username string) (*AdminUser, error) {
	var u AdminUser
	err := s.db.QueryRow(`SELECT id, username, password_hash FROM admin_users WHERE username = ?`, username).
		Scan(&u.ID, &u.Username, &u.PasswordHash)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) SetAdminPassword(username, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	res, err := s.db.Exec(`UPDATE admin_users SET password_hash = ? WHERE username = ?`, string(hash), username)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("管理员用户 %q 不存在", username)
	}
	return nil
}

// ---------- routes ----------

type RouteRecord struct {
	RouteUser                string   `json:"route_user"`
	TargetHost               string   `json:"target_host"`
	TargetPort               int      `json:"target_port"`
	TargetUser               string   `json:"target_user"`
	AuthType                 string   `json:"auth_type"` // password | private_key
	AuthPassword             string   `json:"auth_password,omitempty"`
	AuthPrivateKey           string   `json:"auth_private_key,omitempty"`
	AuthPrivateKeyPassphrase string   `json:"auth_private_key_passphrase,omitempty"`
	AuthorizedKeys           []string `json:"authorized_keys"`

	// 客户端(Claude 侧)连 proxy 这一端的认证:多个公钥 authorized_keys 之外,
	// 还可以选配一个密码作为备用登录方式,两者任一匹配即可登录。
	ListenPassword      string `json:"listen_password,omitempty"`       // 明文,只在设置/修改密码时非空传入
	ClearListenPassword bool   `json:"clear_listen_password,omitempty"` // 传 true 表示移除密码登录,只保留公钥
	HasListenPassword   bool   `json:"has_listen_password"`             // 只读,告知前端当前是否已设置密码

	listenPasswordHash string // 内部字段,不参与 JSON 序列化,供认证时比对
}

func (s *Store) ListRoutes() ([]RouteRecord, error) {
	rows, err := s.db.Query(`SELECT route_user, target_host, target_port, target_user, auth_type,
		auth_password, auth_private_key, auth_private_key_passphrase, listen_password_hash FROM routes ORDER BY route_user`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []RouteRecord
	for rows.Next() {
		var r RouteRecord
		var pw, pk, pp, lph sql.NullString
		if err := rows.Scan(&r.RouteUser, &r.TargetHost, &r.TargetPort, &r.TargetUser, &r.AuthType, &pw, &pk, &pp, &lph); err != nil {
			return nil, err
		}
		r.AuthPassword, r.AuthPrivateKey, r.AuthPrivateKeyPassphrase = pw.String, pk.String, pp.String
		r.listenPasswordHash = lph.String
		r.HasListenPassword = lph.Valid && lph.String != ""
		out = append(out, r)
	}
	rows.Close()

	for i := range out {
		keys, err := s.listAuthorizedKeys(out[i].RouteUser)
		if err != nil {
			return nil, err
		}
		out[i].AuthorizedKeys = keys
	}
	return out, nil
}

func (s *Store) GetRoute(routeUser string) (*RouteRecord, error) {
	var r RouteRecord
	var pw, pk, pp, lph sql.NullString
	err := s.db.QueryRow(`SELECT route_user, target_host, target_port, target_user, auth_type,
		auth_password, auth_private_key, auth_private_key_passphrase, listen_password_hash FROM routes WHERE route_user = ?`, routeUser).
		Scan(&r.RouteUser, &r.TargetHost, &r.TargetPort, &r.TargetUser, &r.AuthType, &pw, &pk, &pp, &lph)
	if err != nil {
		return nil, err
	}
	r.AuthPassword, r.AuthPrivateKey, r.AuthPrivateKeyPassphrase = pw.String, pk.String, pp.String
	r.listenPasswordHash = lph.String
	r.HasListenPassword = lph.Valid && lph.String != ""
	keys, err := s.listAuthorizedKeys(routeUser)
	if err != nil {
		return nil, err
	}
	r.AuthorizedKeys = keys
	return &r, nil
}

func (s *Store) listAuthorizedKeys(routeUser string) ([]string, error) {
	rows, err := s.db.Query(`SELECT public_key FROM route_authorized_keys WHERE route_user = ?`, routeUser)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keys []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, nil
}

func (s *Store) UpsertRoute(r RouteRecord) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var listenHash sql.NullString
	switch {
	case r.ClearListenPassword:
		// 留空,表示移除密码登录
	case r.ListenPassword != "":
		hash, err := bcrypt.GenerateFromPassword([]byte(r.ListenPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("加密登录密码失败: %w", err)
		}
		listenHash = sql.NullString{String: string(hash), Valid: true}
	default:
		// 前端没传新密码也没要求清除,沿用旧值
		var existing sql.NullString
		if err := tx.QueryRow(`SELECT listen_password_hash FROM routes WHERE route_user = ?`, r.RouteUser).Scan(&existing); err == nil {
			listenHash = existing
		}
	}

	_, err = tx.Exec(`INSERT INTO routes(route_user, target_host, target_port, target_user, auth_type,
			auth_password, auth_private_key, auth_private_key_passphrase, listen_password_hash, updated_at)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(route_user) DO UPDATE SET
			target_host = excluded.target_host,
			target_port = excluded.target_port,
			target_user = excluded.target_user,
			auth_type = excluded.auth_type,
			auth_password = excluded.auth_password,
			auth_private_key = excluded.auth_private_key,
			auth_private_key_passphrase = excluded.auth_private_key_passphrase,
			listen_password_hash = excluded.listen_password_hash,
			updated_at = CURRENT_TIMESTAMP`,
		r.RouteUser, r.TargetHost, r.TargetPort, r.TargetUser, r.AuthType,
		r.AuthPassword, r.AuthPrivateKey, r.AuthPrivateKeyPassphrase, listenHash)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(`DELETE FROM route_authorized_keys WHERE route_user = ?`, r.RouteUser); err != nil {
		return err
	}
	for _, k := range r.AuthorizedKeys {
		if k == "" {
			continue
		}
		if _, err := tx.Exec(`INSERT INTO route_authorized_keys(route_user, public_key) VALUES(?, ?)`, r.RouteUser, k); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) DeleteRoute(routeUser string) error {
	_, err := s.db.Exec(`DELETE FROM routes WHERE route_user = ?`, routeUser)
	return err
}

// ---------- audit logs ----------

type AuditLog struct {
	ID         int64     `json:"id"`
	Ts         time.Time `json:"ts"`
	RouteUser  string    `json:"route_user"`
	RemoteAddr string    `json:"remote_addr"`
	TargetHost string    `json:"target_host"`
	TargetPort int       `json:"target_port"`
	EventType  string    `json:"event_type"`
	Detail     string    `json:"detail"`
	ExitStatus *int      `json:"exit_status"`
	Truncated  bool      `json:"truncated"`
}

func (s *Store) InsertAuditLog(a AuditLog) error {
	_, err := s.db.Exec(`INSERT INTO audit_logs(route_user, remote_addr, target_host, target_port, event_type, detail, exit_status, truncated)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
		a.RouteUser, a.RemoteAddr, a.TargetHost, a.TargetPort, a.EventType, a.Detail, a.ExitStatus, boolToInt(a.Truncated))
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func (s *Store) ListAuditLogs(limit int, routeUser string) ([]AuditLog, error) {
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	query := `SELECT id, ts, route_user, remote_addr, target_host, target_port, event_type, detail, exit_status, truncated
		FROM audit_logs`
	args := []any{}
	if routeUser != "" {
		query += ` WHERE route_user = ?`
		args = append(args, routeUser)
	}
	query += ` ORDER BY id DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AuditLog
	for rows.Next() {
		var a AuditLog
		var exitStatus sql.NullInt64
		var truncated int
		if err := rows.Scan(&a.ID, &a.Ts, &a.RouteUser, &a.RemoteAddr, &a.TargetHost, &a.TargetPort,
			&a.EventType, &a.Detail, &exitStatus, &truncated); err != nil {
			return nil, err
		}
		if exitStatus.Valid {
			v := int(exitStatus.Int64)
			a.ExitStatus = &v
		}
		a.Truncated = truncated != 0
		out = append(out, a)
	}
	return out, nil
}

func randomPassword() string {
	b := make([]byte, 12)
	rand.Read(b)
	return hex.EncodeToString(b)
}
