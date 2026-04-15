package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireRole returns a Gin middleware that restricts access to users whose
// role (set earlier by JWTAuth) is contained in the provided list.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"detail": "Недостаточно прав",
				"code":   "FORBIDDEN",
			})
			return
		}

		roleStr, ok := role.(string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"detail": "Недостаточно прав",
				"code":   "FORBIDDEN",
			})
			return
		}

		if _, found := allowed[roleStr]; !found {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"detail": "Недостаточно прав",
				"code":   "FORBIDDEN",
			})
			return
		}

		c.Next()
	}
}
