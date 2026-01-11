package static

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// Handler serves the built frontend from disk with SPA fallback behavior.
func Handler() http.Handler {
	dir := resolveDistDir()
	fileSystem := http.Dir(dir)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		f, err := fileSystem.Open(path)
		if err != nil {
			// Fall back to index for SPA routing
			r.URL.Path = "/index.html"
			http.FileServer(fileSystem).ServeHTTP(w, r)
			return
		}
		f.Close()

		http.FileServer(fileSystem).ServeHTTP(w, r)
	})
}

func resolveDistDir() string {
	if custom := os.Getenv("FRONTEND_DIST"); custom != "" {
		return custom
	}
	cwd, err := os.Getwd()
	if err != nil {
		return "web/dist"
	}
	return filepath.Join(cwd, "web", "dist")
}
