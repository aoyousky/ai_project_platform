package com.aoyou.web.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aoyou.common.core.domain.R;
import com.aoyou.web.domain.vo.HomeResponse;
import com.aoyou.web.domain.vo.WorkbenchResponse;
import com.aoyou.web.service.IDashboardService;

import lombok.RequiredArgsConstructor;

/**
 * SPEC-005 v1.4 §4.1：登录后首页与工作台只读聚合接口。
 *
 * <p>登录校验沿用全局 Sa-Token 拦截器；字段级权限由服务层按 §4.6 降级。</p>
 */
@RequiredArgsConstructor
@RestController
@RequestMapping("/dashboard")
public class DashboardController {

    private final IDashboardService dashboardService;

    @GetMapping("/home")
    public R<HomeResponse> home() {
        return R.ok(dashboardService.home());
    }

    @GetMapping("/workbench")
    public R<WorkbenchResponse> workbench() {
        return R.ok(dashboardService.workbench());
    }
}
