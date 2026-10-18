package com.mugsun.start.metadata;

import java.util.List;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.Name;

/**
 * {@code mugsun.start.*}：UI metadata（{@code GET /api/v1/metadata}）里 initializr 没有的部分。
 * <p>
 * 工程类型、依赖 id 与坐标、bootVersion/javaVersion/packaging 的取值仍以 {@code initializr.*} 为准，
 * 这里只补充中英文文案、常驻/可选模块的扩展字段、字段校验规则、数据库与生成后说明。
 * 两边的 id 在启动时由 {@link MetadataConsistency} 校验，不一致则启动失败。
 */
@ConfigurationProperties("mugsun.start")
public record MugsunStartProperties(String version, Templates templates, Map<String, TypeText> types,
		Map<String, FieldRule> fields, Database database, List<AlwaysOnModule> alwaysOn,
		List<OptionalModule> optional, PostGenerate postGenerate) {

	public MugsunStartProperties {
		templates = (templates != null) ? templates : new Templates(null, null);
		types = (types != null) ? types : Map.of();
		fields = (fields != null) ? fields : Map.of();
		alwaysOn = (alwaysOn != null) ? alwaysOn : List.of();
		optional = (optional != null) ? optional : List.of();
		postGenerate = (postGenerate != null) ? postGenerate : new PostGenerate(null, null, null);
	}

	public record Templates(String boot, String pc) {
	}

	public record TypeText(L10n name, L10n description) {
	}

	/** 字段规则，与设计规格 §3.2 一致；{@code defaultText} 用于需要中英文默认值的字段（description）。 */
	public record FieldRule(String pattern, Integer maxLength, Boolean required, String follows, L10n defaultText) {
	}

	public record Option(String id, String name) {
	}

	public record Database(@Name("default") String defaultId, List<Option> values, L10n note) {

		public Database {
			values = (values != null) ? values : List.of();
		}

	}

	/**
	 * 常驻模块：一期不可去掉。
	 * @param removableIn 预计可去掉的阶段（例如 {@code phase-2}），{@code null} 表示不计划拆分
	 */
	public record AlwaysOnModule(String id, String icon, L10n name, L10n description, String removableIn) {
	}

	public record OptionalModule(String id, String group, String icon, L10n name, L10n description,
			@Name("default") boolean defaultSelected, List<String> appliesTo, List<String> requires,
			List<String> conflicts, Notes notes, Pc pc) {

		public OptionalModule {
			appliesTo = (appliesTo != null) ? appliesTo : List.of();
			requires = (requires != null) ? requires : List.of();
			conflicts = (conflicts != null) ? conflicts : List.of();
		}

	}

	public record Notes(L10n backendOnly) {
	}

	/**
	 * pc 模板中该模块的目录与只属于它的 npm 依赖（来自 pc 裁剪方案，S6 用同一份清单校验预构建归档）。
	 */
	public record Pc(String dir, List<String> npmRemove) {

		public Pc {
			npmRemove = (npmRemove != null) ? npmRemove : List.of();
		}

	}

	/** 生成后的启动说明；命令中的 {@code {artifactId}} 由前端替换。 */
	public record PostGenerate(Map<String, List<String>> requirements, Map<String, List<String>> commands,
			String docs) {

		public PostGenerate {
			requirements = (requirements != null) ? requirements : Map.of();
			commands = (commands != null) ? commands : Map.of();
		}

	}

}
