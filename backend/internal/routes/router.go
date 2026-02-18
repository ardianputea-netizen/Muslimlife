package routes

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"muslimlife/backend/internal/auth"
	"muslimlife/backend/internal/config"
	"muslimlife/backend/internal/handlers"
	"muslimlife/backend/internal/middleware"
)

func New(db *gorm.DB, cfg config.Config, jwtManager *auth.Manager) *gin.Engine {
	router := gin.Default()
	router.Use(middleware.SecurityHeaders())

	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.ClientOriginAllow,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	authHandler := handlers.NewAuthHandler(jwtManager, cfg)
	router.POST("/auth/refresh", authHandler.Refresh)
	router.POST("/auth/dev-token", authHandler.DevToken)

	ibadahHandler := handlers.NewIbadahHandler(db)
	ramadhanHandler := handlers.NewRamadhanHandler(db)
	hadithHandler := handlers.NewHadithHandler(db, cfg)
	duaHandler := handlers.NewDuaHandler(db)

	protected := router.Group("/")
	protected.Use(middleware.RequireAuth(jwtManager))

	protected.GET("/ibadah/prayer", ibadahHandler.GetPrayerMonth)
	protected.POST("/ibadah/prayer/checkin", ibadahHandler.UpsertPrayerCheckin)
	protected.GET("/ibadah/prayer/stats", ibadahHandler.GetPrayerStats)
	protected.GET("/ibadah/prayer/times", ibadahHandler.GetPrayerTimes)

	protected.GET("/ramadhan", ramadhanHandler.GetMonth)
	protected.POST("/ramadhan/checkin", ramadhanHandler.UpsertCheckin)
	protected.GET("/ramadhan/stats", ramadhanHandler.GetStats)

	protected.GET("/hadith", hadithHandler.List)
	protected.GET("/hadith/bookmarks", hadithHandler.ListBookmarks)
	protected.POST("/hadith/bookmark", hadithHandler.Bookmark)
	protected.GET("/hadith/:id", hadithHandler.Detail)

	protected.GET("/duas", duaHandler.List)
	protected.GET("/duas/today", duaHandler.Today)
	protected.POST("/duas/bookmark", duaHandler.Bookmark)
	protected.GET("/duas/bookmarks", duaHandler.Bookmarks)

	return router
}
