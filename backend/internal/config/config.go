package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv            string
	Port              string
	DatabaseURL       string
	AccessJWTSecret   string
	RefreshJWTSecret  string
	AccessTokenTTL    time.Duration
	RefreshTokenTTL   time.Duration
	ClientOriginAllow []string
	HadithAPIBaseURL  string
	HadithAPIKey      string
	HadithSourceName  string
	HadithPageLimit   int
}

func Load() Config {
	return Config{
		AppEnv:            getEnv("APP_ENV", "development"),
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		AccessJWTSecret:   getEnv("ACCESS_JWT_SECRET", "dev_access_secret_change_me"),
		RefreshJWTSecret:  getEnv("REFRESH_JWT_SECRET", "dev_refresh_secret_change_me"),
		AccessTokenTTL:    time.Duration(getEnvInt("ACCESS_TOKEN_TTL_MINUTES", 15)) * time.Minute,
		RefreshTokenTTL:   time.Duration(getEnvInt("REFRESH_TOKEN_TTL_HOURS", 24*30)) * time.Hour,
		ClientOriginAllow: parseCSV(getEnv("CLIENT_ORIGINS", "http://localhost:3000,http://localhost:5173")),
		HadithAPIBaseURL:  getEnv("HADITH_API_BASE_URL", "https://api.sunnah.com/v1"),
		HadithAPIKey:      strings.TrimSpace(os.Getenv("HADITH_API_KEY")),
		HadithSourceName:  getEnv("HADITH_SOURCE_NAME", "Sunnah.com API"),
		HadithPageLimit:   getEnvInt("HADITH_PAGE_LIMIT", 20),
	}
}

func getEnv(key string, defaultValue string) string {
	value := os.Getenv(key)
	if strings.TrimSpace(value) == "" {
		return defaultValue
	}
	return value
}

func getEnvInt(key string, defaultValue int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}

	return parsed
}

func parseCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))

	for _, part := range parts {
		clean := strings.TrimSpace(part)
		if clean != "" {
			out = append(out, clean)
		}
	}

	if len(out) == 0 {
		return []string{"*"}
	}

	return out
}
