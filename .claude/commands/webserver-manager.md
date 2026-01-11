---
description: Web server management command for nginx, Apache, and IIS. Supports SSL, load balancing, subdomains, security, optimization, HTTPS redirect, HTTP/2, backup, restore, and troubleshooting.
argument-hint: [webserver] [action] [options]
---

# Web Server Manager

Integrated command for managing nginx, Apache, and IIS web servers.

## Supported Web Servers

| Web Server | Supported Actions |
|-------------|-------------------|
| nginx | ssl, loadbalancer, subdomain, security, optimize, https-redirect, http2, backup, restore, troubleshoot |
| Apache | ssl, loadbalancer, subdomain, security, optimize, https-redirect, http2, backup, restore, troubleshoot |
| IIS | ssl, loadbalancer, subdomain, security, optimize, https-redirect, http2, backup, restore, troubleshoot |

## Actions

### ssl
SSL certificate management:
- Certificate registration (Let's Encrypt, commercial)
- Certificate renewal and automation
- TLS configuration (1.2, 1.3)
- Certificate validation and troubleshooting

### loadbalancer
Load balancing and traffic distribution:
- Upstream/backend server configuration
- Load balancing algorithms (round-robin, least_conn, ip_hash)
- Health check setup
- Session persistence (sticky sessions)
- Failover handling

### subdomain
Subdomain management:
- Virtual host/server block configuration
- Wildcard subdomain handling
- SNI (Server Name Indication) setup
- DNS integration guidance

### security
Security hardening:
- Security headers (HSTS, X-Frame-Options, CSP)
- Rate limiting
- IP whitelisting/blacklisting
- DDoS mitigation
- SSL/TLS hardening

### optimize
Performance optimization:
- Worker/process tuning
- Keepalive optimization
- Caching strategies
- Compression (gzip, brotli, deflate)
- Connection limits and timeouts
- Buffer size tuning

### https-redirect
HTTP to HTTPS redirection:
- Permanent (301) redirects
- Redirect loop prevention
- Preserve query parameters
- HSTS configuration

### http2
HTTP/2 configuration:
- HTTP/2 module enablement
- Server push configuration
- Multiplexing setup
- ALPN negotiation
- HTTP/2 health checks

### backup
Backup operations:
- Configuration file backup
- Automatic backup scheduling
- Version control integration
- Certificate backup

### restore
Restore operations:
- Configuration restoration
- Versioned backup retrieval
- Rollback procedures
- Disaster recovery

## Usage Examples

```bash
# nginx SSL certificate registration
/webserver-manager nginx ssl example.com

# Apache load balancing with specific backend servers
/webserver-manager apache loadbalancer backend1.example.com:8080 backend2.example.com:8080

# IIS subdomain wildcard setup
/webserver-manager iis subdomain wildcard api.example.com

# nginx security hardening
/webserver-manager nginx security

# Apache performance optimization
/webserver-manager apache optimize

# IIS HTTP/2 configuration
/webserver-manager iis http2 enable

# nginx backup configuration files
/webserver-manager nginx backup /etc/nginx

# Apache restore from specific backup
/webserver-manager apache restore /path/to/backup/apache-backup-2025-01-11.tar.gz

# nginx troubleshooting 502 error
/webserver-manager nginx troubleshoot 502 bad gateway

# Apache troubleshooting high CPU usage
/webserver-manager apache troubleshoot high-cpu

# IIS SSL handshake failure
/webserver-manager iis troubleshoot ssl-handshake-fail
```

## Free Input

After the webserver and action parameters, you can add free-form input:
- Domain names
- Backend server addresses
- Certificate paths
- Specific configuration options
- Error messages or symptoms
- File paths
- Environment names (staging, production)

Examples:
```bash
# Specific domain with certificate authority
/webserver-manager nginx ssl example.com --authority digicert

# Multiple backend servers for load balancing
/webserver-manager nginx loadbalancer 10.0.1.1:8080 10.0.1.2:8080 10.0.1.3:8080 algorithm=least_conn

# Apache with subdomain and document root
/webserver-manager apache subdomain api.example.com --document-root /var/www/api

# IIS with environment
/webserver-manager iis backup --environment staging

# nginx with detailed error context
/webserver-manager nginx troubleshoot "upstream timeout (110: Connection timed out) connecting to backend"
```

## Workflow

The command will:
1. Parse the webserver parameter (nginx, apache, iis)
2. Parse the action parameter
3. Route to the appropriate expert agent (Task tool)
4. Provide the action and any additional input to the agent
5. Return expert's recommendations and configuration guidance

Each expert agent specializes in their respective web server and provides comprehensive, production-ready guidance for all supported actions.
