package org.dromara.fixtures.compliant.application;

import java.util.Optional;

import org.dromara.fixtures.compliant.domain.Order;
import org.dromara.fixtures.compliant.domain.OrderRepository;

/**
 * 合规夹具：application 只依赖 domain，不依赖 interfaces。
 */
public class OrderAppService {

    private final OrderRepository orderRepository;

    public OrderAppService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public Optional<Order> load(String orderId) {
        return orderRepository.findById(orderId);
    }
}
