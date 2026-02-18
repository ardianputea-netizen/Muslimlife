package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"muslimlife/backend/internal/auth"
)

const userIDContextKey = "user_id"

func RequireAuth(jwtManager *auth.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		claims, err := jwtManager.ValidateAccessToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		c.Set(userIDContextKey, claims.UserID)
		c.Next()
	}
}

func GetUserID(c *gin.Context) string {
	value, ok := c.Get(userIDContextKey)
	if !ok {
		return ""
	}

	userID, ok := value.(string)
	if !ok {
		return ""
	}

	return userID
}
