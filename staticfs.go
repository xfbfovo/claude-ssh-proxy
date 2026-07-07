package main

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:webui/dist
var embeddedWebUI embed.FS

func webUIHandler() http.Handler {
	sub, err := fs.Sub(embeddedWebUI, "webui/dist")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := fs.Stat(sub, r.URL.Path[1:]); err != nil {
			// SPA 路由:找不到对应静态文件时回退到 index.html
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})
}
