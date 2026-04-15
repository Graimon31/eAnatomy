package middleware

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

const ipRangesCacheKey = "ip_ranges_cache"
const ipRangesCacheTTL = 5 * time.Minute

// CIDRProvider is a function that returns the current list of allowed CIDR
// ranges from the primary data source (e.g. the database).
type CIDRProvider func(ctx context.Context) ([]string, error)

// RequirePremium returns a Gin middleware that gates access to premium content.
//
// Access is granted when any of the following is true:
//  1. The user has an active subscription (subscriptionActive == true in the context).
//  2. The client IP falls within one of the institutional CIDR ranges.
//
// CIDR ranges are cached in Redis under the key "ip_ranges_cache" for 5 minutes
// to avoid hitting the database on every request.
func RequirePremium(redisClient *redis.Client, provider CIDRProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Fast path: user subscription is active.
		if active, exists := c.Get("subscriptionActive"); exists {
			if isActive, ok := active.(bool); ok && isActive {
				c.Next()
				return
			}
		}

		// Slow path: check client IP against cached CIDR ranges.
		clientIP := c.ClientIP()
		if clientIP == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"detail": "Требуется подписка",
				"code":   "SUBSCRIPTION_REQUIRED",
			})
			return
		}

		cidrs, err := getCachedCIDRs(c.Request.Context(), redisClient, provider)
		if err != nil {
			// If we cannot determine ranges, deny access rather than fail open.
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"detail": "Требуется подписка",
				"code":   "SUBSCRIPTION_REQUIRED",
			})
			return
		}

		ip := net.ParseIP(clientIP)
		if ip == nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"detail": "Требуется подписка",
				"code":   "SUBSCRIPTION_REQUIRED",
			})
			return
		}

		for _, cidr := range cidrs {
			_, network, err := net.ParseCIDR(cidr)
			if err != nil {
				continue
			}
			if network.Contains(ip) {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"detail": "Требуется подписка",
			"code":   "SUBSCRIPTION_REQUIRED",
		})
	}
}

// getCachedCIDRs returns CIDR ranges from Redis cache, falling back to the
// provider function and repopulating the cache on a miss.
func getCachedCIDRs(ctx context.Context, rdb *redis.Client, provider CIDRProvider) ([]string, error) {
	// Try cache first.
	data, err := rdb.Get(ctx, ipRangesCacheKey).Bytes()
	if err == nil {
		var cidrs []string
		if jsonErr := json.Unmarshal(data, &cidrs); jsonErr == nil {
			return cidrs, nil
		}
	}

	// Cache miss or decode error — fetch from the primary source.
	cidrs, err := provider(ctx)
	if err != nil {
		return nil, err
	}

	// Store back into Redis (best-effort).
	if encoded, jsonErr := json.Marshal(cidrs); jsonErr == nil {
		_ = rdb.Set(ctx, ipRangesCacheKey, encoded, ipRangesCacheTTL).Err()
	}

	return cidrs, nil
}
