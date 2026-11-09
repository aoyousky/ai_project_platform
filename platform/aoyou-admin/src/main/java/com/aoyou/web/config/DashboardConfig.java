package com.aoyou.web.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 注册首页/工作台配置。
 */
@Configuration
@EnableConfigurationProperties(DashboardProperties.class)
public class DashboardConfig {
}
