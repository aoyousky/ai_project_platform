-- SPEC-010 数据种子：平台调度组 aoyou_group 与可手动触发的测试任务。
--
-- 幂等：按 (namespace_id, group_name) / (namespace_id, biz_id) 唯一键判重，
-- 环境重建（down -v）后重复执行不会产生第二份组或任务（A-04 要求 count = 1）。
-- 任务默认关闭（job_status=0），执行记录只来自手动触发，
-- 避免定时调度额外产生记录干扰 A-06「记录数 = 触发次数」。

INSERT INTO `sj_group_config`
    (`namespace_id`, `group_name`, `description`, `token`, `group_status`,
     `version`, `group_partition`, `id_generator_mode`, `init_scene`, `create_dt`, `update_dt`)
SELECT 'dev', 'aoyou_group', '平台后端调度组',
       'SJ_cKqBTPzCsWA3VyuCfFoccmuIEGXjr5KT', 1, 1, 0, 1, 1, now(), now()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM `sj_group_config` WHERE `namespace_id` = 'dev' AND `group_name` = 'aoyou_group'
);

INSERT INTO `sj_job`
    (`namespace_id`, `biz_id`, `group_name`, `job_name`, `args_str`, `args_type`,
     `next_trigger_at`, `job_status`, `task_type`, `route_key`, `executor_type`,
     `executor_info`, `trigger_type`, `trigger_interval`, `block_strategy`,
     `executor_timeout`, `max_retry_times`, `parallel_num`, `retry_interval`,
     `bucket_index`, `resident`, `notify_ids`, `owner_id`, `labels`, `description`,
     `ext_attrs`, `deleted`, `create_dt`, `update_dt`)
SELECT 'dev', 'aoyou-demo-job', 'aoyou_group', 'aoyou-demo-job', NULL, 1,
       (UNIX_TIMESTAMP() + 60) * 1000, 0, 1, 4, 1,
       'testJobExecutor', 2, '60', 1,
       60, 3, 1, 1,
       116, 0, '', 1, '', '',
       '', 0, now(), now()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM `sj_job` WHERE `namespace_id` = 'dev' AND `biz_id` = 'aoyou-demo-job'
);
