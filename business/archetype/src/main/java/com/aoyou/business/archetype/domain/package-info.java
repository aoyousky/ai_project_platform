/**
 * domain 层：业务真相。
 *
 * <p>职责：聚合、实体、值对象、领域事件、仓储接口。
 *
 * <p>约束（宪章 II，NON-NEGOTIABLE）：
 * <ul>
 *   <li>零框架依赖：禁止 import Spring / MyBatis / Jackson 及其注解；</li>
 *   <li>禁止依赖 {@code ..application..}、{@code ..interfaces..}、{@code ..infrastructure..}；</li>
 *   <li>聚合根是事务一致性的唯一边界；值对象不可变。</li>
 * </ul>
 */
package com.aoyou.business.archetype.domain;
