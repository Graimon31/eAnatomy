package middleware

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims represents the custom JWT claims used throughout the application.
type Claims struct {
	UserID             uuid.UUID `json:"user_id"`
	Role               string    `json:"role"`
	SubscriptionActive bool      `json:"subscription_active"`
	jwt.RegisteredClaims
}

// JWTConfig holds the parameters needed for token generation and validation.
type JWTConfig struct {
	Secret     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
}

// JWTAuth returns a Gin middleware that validates JWT Bearer tokens.
// Requests without a valid token receive a 401 JSON response.
func JWTAuth(cfg JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"detail": "Отсутствует токен авторизации",
				"code":   "UNAUTHORIZED",
			})
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"detail": "Неверный формат заголовка Authorization",
				"code":   "UNAUTHORIZED",
			})
			return
		}

		claims, err := ParseToken(parts[1], cfg.Secret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"detail": "Недействительный или просроченный токен",
				"code":   "INVALID_TOKEN",
			})
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)
		c.Set("subscriptionActive", claims.SubscriptionActive)
		c.Next()
	}
}

// GenerateAccessToken creates a short-lived JWT access token for the given user.
func GenerateAccessToken(cfg JWTConfig, userID uuid.UUID, role string, subscriptionActive bool) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:             userID,
		Role:               role,
		SubscriptionActive: subscriptionActive,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(cfg.AccessTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.Secret))
}

// GenerateRefreshToken creates a long-lived JWT refresh token for the given user.
// The refresh token carries the same claims but uses a longer TTL.
func GenerateRefreshToken(cfg JWTConfig, userID uuid.UUID, role string, subscriptionActive bool) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:             userID,
		Role:               role,
		SubscriptionActive: subscriptionActive,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(cfg.RefreshTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.Secret))
}

// ParseToken validates the raw JWT string and returns the embedded claims.
func ParseToken(tokenString string, secret string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
