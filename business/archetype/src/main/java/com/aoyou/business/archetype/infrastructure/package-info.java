/**
 * infrastructure 层：技术实现。
 *
 * <p>职责：仓储实现、外部系统适配、消息与缓存。
 *
 * <p>约束（宪章 II）：
 * <ul>
 *   <li>仓储接口定义在 domain，本层只做实现；</li>
 *   <li>禁止依赖 {@code ..interfaces..}；</li>
 *   <li>MyBatis Mapper 放在 {@code ...infrastructure.mapper}，由 {@code com.aoyou.**.mapper} 扫描。</li>
 * </ul>
 */
package com.aoyou.business.archetype.infrastructure;
