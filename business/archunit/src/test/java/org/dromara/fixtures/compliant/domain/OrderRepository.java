package org.dromara.fixtures.compliant.domain;

import java.util.Optional;

/**
 * 合规夹具：仓储接口定义在 domain 层，实现在 infrastructure 层。
 */
public interface OrderRepository {

    Optional<Order> findById(String orderId);
}
