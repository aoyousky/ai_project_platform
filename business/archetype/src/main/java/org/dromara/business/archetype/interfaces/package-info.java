/**
 * interfaces 层：协议转换。
 *
 * <p>职责：参数校验、DTO ↔ 领域对象映射、组装响应体。
 *
 * <p>约束（宪章 II）：
 * <ul>
 *   <li>禁止直接返回 DO/PO；</li>
 *   <li>禁止依赖 {@code ..infrastructure..}；</li>
 *   <li>禁止在此层写业务规则或拼装 SQL。</li>
 * </ul>
 */
package org.dromara.business.archetype.interfaces;
