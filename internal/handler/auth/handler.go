package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/graimon31/eanatomy/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var input service.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	resp, err := h.authService.Register(input)
	if err != nil {
		switch err {
		case service.ErrEmailExists:
			c.JSON(http.StatusConflict, gin.H{
				"detail": err.Error(),
				"code":   "EMAIL_EXISTS",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "registration failed",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var input service.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	resp, err := h.authService.Login(input)
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{
				"detail": err.Error(),
				"code":   "INVALID_CREDENTIALS",
			})
		default:
			c.JSON(http.StatusUnauthorized, gin.H{
				"detail": err.Error(),
				"code":   "LOGIN_FAILED",
			})
		}
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var input struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	resp, err := h.authService.RefreshTokens(input.RefreshToken)
	if err != nil {
		switch err {
		case service.ErrInvalidToken:
			c.JSON(http.StatusUnauthorized, gin.H{
				"detail": err.Error(),
				"code":   "INVALID_TOKEN",
			})
		case service.ErrUserNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "USER_NOT_FOUND",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "token refresh failed",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var input struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	_ = h.authService.Logout(input.RefreshToken)

	c.JSON(http.StatusOK, gin.H{"detail": "logged out"})
}

func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"detail": "unauthorized",
			"code":   "UNAUTHORIZED",
		})
		return
	}

	uid, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "invalid user ID in context",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	user, err := h.authService.GetCurrentUser(uid)
	if err != nil {
		switch err {
		case service.ErrUserNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "USER_NOT_FOUND",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "failed to fetch user",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) UpdateMe(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"detail": "unauthorized",
			"code":   "UNAUTHORIZED",
		})
		return
	}

	uid, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"detail": "invalid user ID in context",
			"code":   "INTERNAL_ERROR",
		})
		return
	}

	var input service.UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": err.Error(),
			"code":   "VALIDATION_ERROR",
		})
		return
	}

	user, err := h.authService.UpdateProfile(uid, input)
	if err != nil {
		switch err {
		case service.ErrUserNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"detail": err.Error(),
				"code":   "USER_NOT_FOUND",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"detail": "failed to update profile",
				"code":   "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, user)
}
