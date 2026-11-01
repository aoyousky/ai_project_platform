/**
 * application 层：用例编排。
 *
 * <p>职责：事务边界、鉴权、幂等、编排领域服务与仓储。
 *
 * <p>约束（宪章 II）：
 * <ul>
 *   <li>禁止在此层写业务规则（规则属于 domain）；</li>
 *   <li>禁止依赖 {@code ..interfaces..}；</li>
 *   <li>事务只在本层开启，禁止事务内远程调用。</li>
 * </ul>
 */
package com.aoyou.business.archetype.application;
