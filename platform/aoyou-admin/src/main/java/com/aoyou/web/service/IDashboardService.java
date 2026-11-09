package com.aoyou.web.service;

import com.aoyou.web.domain.vo.HomeResponse;
import com.aoyou.web.domain.vo.WorkbenchResponse;

/**
 * SPEC-005 §4.1：首页与工作台只读聚合服务。
 */
public interface IDashboardService {

    HomeResponse home();

    WorkbenchResponse workbench();
}
