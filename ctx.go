package main

import "context"

type ctxKey int

const usernameCtxKey ctxKey = 0

func withUsername(ctx context.Context, username string) context.Context {
	return context.WithValue(ctx, usernameCtxKey, username)
}

func usernameFromContext(ctx context.Context) string {
	v, _ := ctx.Value(usernameCtxKey).(string)
	return v
}
