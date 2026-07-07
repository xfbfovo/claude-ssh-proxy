package main

import (
	"bytes"
	"fmt"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/crypto/ssh"
)

// buildPublicKeyCallback 每次认证尝试都查库:根据登录用户名找到路由,
// 校验客户端公钥是否在该路由配置的 authorized_keys 里。
func buildPublicKeyCallback(store *Store) func(conn ssh.ConnMetadata, key ssh.PublicKey) (*ssh.Permissions, error) {
	return func(conn ssh.ConnMetadata, key ssh.PublicKey) (*ssh.Permissions, error) {
		user := conn.User()
		route, err := store.GetRoute(user)
		if err != nil {
			return nil, fmt.Errorf("未知用户名 %q", user)
		}
		for _, line := range route.AuthorizedKeys {
			allowed, _, _, _, err := ssh.ParseAuthorizedKey([]byte(line))
			if err != nil {
				continue
			}
			if bytes.Equal(allowed.Marshal(), key.Marshal()) {
				return &ssh.Permissions{
					Extensions: map[string]string{"route-user": user},
				}, nil
			}
		}
		return nil, fmt.Errorf("公钥不匹配用户 %q", user)
	}
}

// buildPasswordCallback 是公钥认证之外的备用登录方式:路由如果配置了 listen 密码,
// 客户端也可以直接用密码连 proxy(用户名仍然决定路由到哪台目标机器)。
func buildPasswordCallback(store *Store) func(conn ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
	return func(conn ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
		user := conn.User()
		route, err := store.GetRoute(user)
		if err != nil || route.listenPasswordHash == "" {
			return nil, fmt.Errorf("用户 %q 未启用密码登录", user)
		}
		if bcrypt.CompareHashAndPassword([]byte(route.listenPasswordHash), password) != nil {
			return nil, fmt.Errorf("密码错误")
		}
		return &ssh.Permissions{
			Extensions: map[string]string{"route-user": user},
		}, nil
	}
}
