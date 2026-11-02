package com.aoyou.fixtures.compliant.infrastructure;

import java.util.Optional;

import com.aoyou.fixtures.compliant.domain.Order;
import com.aoyou.fixtures.compliant.domain.OrderRepository;

/**
 * 合规夹具：infrastructure 实现 domain 定义的仓储接口，不依赖 interfaces。
 */
public class InMemoryOrderRepository implements OrderRepository {

    @Override
    public Optional<Order> findById(String orderId) {
        return Optional.empty();
    }
}
