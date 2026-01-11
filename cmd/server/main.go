package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/schlubbi/score_board/internal/api"
	"github.com/schlubbi/score_board/internal/groups"
	"github.com/schlubbi/score_board/internal/model"
	"github.com/schlubbi/score_board/internal/repository"
	"github.com/schlubbi/score_board/internal/scraper"
	"github.com/schlubbi/score_board/internal/service"
	"github.com/schlubbi/score_board/internal/static"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	groupConfigs := make([]model.GroupConfig, 0)
	for _, g := range groups.KasselEJugend() {
		groupConfigs = append(groupConfigs, model.GroupConfig{
			ID:        g.ID,
			Name:      g.Name,
			StaffelID: g.StaffelID,
		})
	}

	repo := repository.New()
	svc := service.New(scraper.New(nil), repo, groupConfigs)

	log.Println("scraping initial data ...")
	if err := svc.Refresh(ctx); err != nil {
		log.Fatalf("initial scrape failed: %v", err)
	}

	handler := api.NewHandler(svc)

	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	handler.RegisterRoutes(r)

	// Serve frontend last so /api takes precedence
	r.Handle("/*", static.Handler())

	port := getEnv("PORT", "8080")
	server := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	go func() {
		log.Printf("server listening on http://localhost:%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelShutdown()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
