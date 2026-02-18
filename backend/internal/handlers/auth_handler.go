package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"muslimlife/backend/internal/auth"
	"muslimlife/backend/internal/config"
)

type AuthHandler struct {
	jwtManager *auth.Manager
	cfg        config.Config
}

func NewAuthHandler(jwtManager *auth.Manager, cfg config.Config) *AuthHandler {
	return &AuthHandler{
		jwtManager: jwtManager,
		cfg:        cfg,
	}
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var request refreshRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	claims, err := h.jwtManager.ValidateRefreshToken(strings.TrimSpace(request.RefreshToken))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	accessToken, refreshToken, err := h.jwtManager.GenerateTokens(claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to rotate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

type devTokenRequest struct {
	UserID string `json:"user_id" binding:"required"`
}

func (h *AuthHandler) DevToken(c *gin.Context) {
	if strings.ToLower(h.cfg.AppEnv) != "development" {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var request devTokenRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	accessToken, refreshToken, err := h.jwtManager.GenerateTokens(strings.TrimSpace(request.UserID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}
