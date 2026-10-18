export default {
  header: { docs: '文档', lang: '语言', theme: { toDark: '切换到深色模式', toLight: '切换到浅色模式' }, github: 'GitHub 仓库', menu: '菜单', darkLabel: '深色模式' },
  title: '创建 mugsun 项目',
  subtitle: '选择模块并填写项目信息，生成可直接运行的工程。',
  offline: '网络已断开，恢复后可继续生成',
  info: { title: '项目信息', scope: '生成范围', meta: '项目元数据', build: '构建参数' },
  form: {
    group: 'Group', artifact: 'Artifact', name: '项目名称', packageName: '包名', description: '描述', database: '数据库',
    databaseHint: '一期仅支持 PostgreSQL', restore: '恢复自动', boot: 'Spring Boot', java: 'JDK', packaging: '打包方式',
    err: {
      groupRequired: '请填写 Group。',
      group: 'Group 只能包含小写字母、数字、下划线和点，且不能以数字开头。',
      artifactRequired: '请填写 Artifact。',
      artifact: 'Artifact 只能包含小写字母、数字和连字符，且须以字母开头，最长 50 个字符。',
      nameRequired: '请填写项目名称。',
      name: '项目名称最长 50 个字符。',
      packageRequired: '请填写包名。',
      packageName: '包名须由小写字母、数字和下划线组成的段以点连接，各段不能以数字开头，也不能是 Java 关键字。',
      description: '描述最长 200 个字符。'
    }
  },
  modules: {
    title: '模块', included: '已包含', docs: '文档', docsAria: '{name}文档（在新窗口打开）',
    notApplicable: '当前生成范围不适用此模块。',
    loadError: '模块列表加载失败，请检查网络后重试。', retry: '重试'
  },
  preview: { title: '目录结构', files: '共 {n} 个文件', empty: '暂无可预览的文件', updated: '目录已更新，共 {n} 个文件' },
  bar: {
    summary: '{scope} · 已选 {n} 个可选模块 · {pkg}',
    share: '复制分享链接', shared: '分享链接已复制', download: '下载 ZIP', generating: '正在生成…',
    shortcut: '快捷键：{key} + Enter', slow: '生成时间较长，请稍候', guide: '启动说明',
    disabledMeta: '模块列表加载失败，暂时无法生成',
    invalid: '有 {n} 项信息需要修改',
    failed: '生成失败，请稍后重试（错误编号：{id}）'
  },
  drawer: {
    title: '项目已生成', env: '环境要求', commands: '启动命令', copy: '复制', copied: '已复制',
    access: '访问地址与默认账号',
    accessText: '启动后的访问地址和默认管理员账号见工程 README 的「快速开始」一节。页面不展示密码。',
    docs: '查看完整文档'
  }
}
