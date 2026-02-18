package main

import (
	"log"

	"github.com/joho/godotenv"

	"muslimlife/backend/internal/auth"
	"muslimlife/backend/internal/config"
	"muslimlife/backend/internal/database"
	"muslimlife/backend/internal/models"
	"muslimlife/backend/internal/routes"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}

	if err := db.AutoMigrate(
		&models.PrayerCheckin{},
		&models.RamadhanCheckin{},
		&models.Hadith{},
		&models.HadithBookmark{},
		&models.Dua{},
		&models.DuaBookmark{},
	); err != nil {
		log.Fatalf("auto migration failed: %v", err)
	}

	jwtManager := auth.NewManager(
		cfg.AccessJWTSecret,
		cfg.RefreshJWTSecret,
		cfg.AccessTokenTTL,
		cfg.RefreshTokenTTL,
	)

	router := routes.New(db, cfg, jwtManager)
	log.Printf("server listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
