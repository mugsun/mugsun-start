package com.mugsun.start.metadata;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

import com.mugsun.start.metadata.MugsunStartProperties.AlwaysOnModule;
import com.mugsun.start.metadata.MugsunStartProperties.OptionalModule;
import io.spring.initializr.metadata.DependencyGroup;
import io.spring.initializr.metadata.InitializrMetadata;
import io.spring.initializr.metadata.MetadataElement;
import io.spring.initializr.metadata.Type;

/**
 * 校验 {@code mugsun.start.*} 与 {@code initializr.*} 一致：常驻模块对应 dependencies 第 1 组，
 * 可选模块对应第 2 组，类型、appliesTo、requires/conflicts、生成后说明的键都必须存在。
 * 所有下发给前端的文案（类型与模块的 name/description、notes、database.note、字段默认文案）都必须中英文齐全，
 * 否则拒绝启动，不在运行时回落成单语。
 */
public final class MetadataConsistency {

	/**
	 * 模块图标是固定枚举（与前端约定），每个模块一个，不可重复。新增模块时两边同时扩充。
	 */
	public static final List<String> ICONS = List.of("system", "security", "audit", "file", "flow", "lowcode", "open",
			"ops", "map", "track", "ai");

	private MetadataConsistency() {
	}

	public static List<String> check(InitializrMetadata metadata, MugsunStartProperties props) {
		List<String> problems = new ArrayList<>();
		Set<String> typeIds = new LinkedHashSet<>(metadata.getTypes().getContent().stream().map(Type::getId).toList());
		sameIds(problems, "mugsun.start.types", props.types().keySet(), typeIds);
		props.types().forEach((id, text) -> {
			required(problems, "mugsun.start.types." + id + ".name", (text != null) ? text.name() : null);
			required(problems, "mugsun.start.types." + id + ".description", (text != null) ? text.description() : null);
		});
		props.fields().forEach((id, rule) -> optional(problems, "mugsun.start.fields." + id + ".default-text",
				(rule != null) ? rule.defaultText() : null));
		fields(problems, props.fields());
		if (props.database() != null) {
			optional(problems, "mugsun.start.database.note", props.database().note());
		}

		List<DependencyGroup> groups = metadata.getDependencies().getContent();
		if (groups.size() != 2) {
			problems.add("initializr.dependencies 必须正好两组（常驻、可选），实际 " + groups.size() + " 组");
		}
		else {
			sameIds(problems, "mugsun.start.always-on", ids(props.alwaysOn().stream().map(AlwaysOnModule::id).toList()),
					ids(groups.get(0).getContent().stream().map(MetadataElement::getId).toList()));
			sameIds(problems, "mugsun.start.optional", ids(props.optional().stream().map(OptionalModule::id).toList()),
					ids(groups.get(1).getContent().stream().map(MetadataElement::getId).toList()));
		}
		Set<String> seen = new HashSet<>();
		Set<String> icons = new HashSet<>();
		concatIcons(props).forEach((icon) -> {
			if (icon == null || !ICONS.contains(icon)) {
				problems.add("模块图标 " + icon + " 不在约定的枚举 " + ICONS + " 中");
			}
			else if (!icons.add(icon)) {
				problems.add("模块图标重复：" + icon);
			}
		});
		props.alwaysOn().forEach((m) -> {
			if (!seen.add(m.id())) {
				problems.add("模块 id 重复：" + m.id());
			}
			required(problems, "常驻模块 " + m.id() + " 的 name", m.name());
			required(problems, "常驻模块 " + m.id() + " 的 description", m.description());
		});
		Set<String> optionalIds = new HashSet<>(props.optional().stream().map(OptionalModule::id).toList());
		for (OptionalModule m : props.optional()) {
			if (!seen.add(m.id())) {
				problems.add("模块 id 重复：" + m.id());
			}
			required(problems, "可选模块 " + m.id() + " 的 name", m.name());
			required(problems, "可选模块 " + m.id() + " 的 description", m.description());
			if (m.notes() != null) {
				optional(problems, "可选模块 " + m.id() + " 的 notes.backend-only", m.notes().backendOnly());
			}
			if (m.appliesTo().isEmpty()) {
				problems.add("可选模块 " + m.id() + " 的 applies-to 不能为空");
			}
			m.appliesTo().stream().filter((t) -> !typeIds.contains(t))
				.forEach((t) -> problems.add("可选模块 " + m.id() + " 的 applies-to 含未知类型 " + t));
			for (String r : concat(m.requires(), m.conflicts())) {
				if (r.equals(m.id()) || !optionalIds.contains(r)) {
					problems.add("可选模块 " + m.id() + " 的 requires/conflicts 含无效 id " + r);
				}
			}
			if (m.pc() == null || m.pc().dir() == null || m.pc().dir().isBlank()) {
				problems.add("可选模块 " + m.id() + " 缺少 pc.dir");
			}
		}

		sameIds(problems, "mugsun.start.post-generate.requirements", props.postGenerate().requirements().keySet(),
				typeIds);
		sameIds(problems, "mugsun.start.post-generate.commands", props.postGenerate().commands().keySet(), typeIds);
		if (props.database() == null || props.database().values().stream()
			.noneMatch((o) -> o.id().equals(props.database().defaultId()))) {
			problems.add("mugsun.start.database.default 必须是 values 中的一项");
		}
		return problems;
	}

	/** 必填文案：缺失或缺中文/英文都算问题。 */
	/** 校验器认识的字段；mugsun.start.fields 只能配置这些键（G5）。 */
	public static final List<String> FIELD_KEYS = List.of("groupId", "artifactId", "name", "description", "packageName");

	/** G5：字段键名必须是校验器认识的；pattern 必须能编译；max-length 必须为正数。 */
	static void fields(List<String> problems, Map<String, MugsunStartProperties.FieldRule> fields) {
		if (fields == null) {
			return;
		}
		fields.forEach((id, rule) -> {
			String what = "mugsun.start.fields." + id;
			if (!FIELD_KEYS.contains(id)) {
				problems.add(what + "：未知字段，只支持 " + FIELD_KEYS);
			}
			if (rule == null) {
				return;
			}
			if (rule.pattern() != null) {
				try {
					Pattern.compile(rule.pattern());
				}
				catch (PatternSyntaxException ex) {
					problems.add(what + ".pattern 不是合法的正则：" + ex.getDescription());
				}
			}
			if (rule.maxLength() != null && rule.maxLength() <= 0) {
				problems.add(what + ".max-length 必须大于 0");
			}
		});
	}

	private static void required(List<String> problems, String what, L10n text) {
		if (text == null || !text.complete()) {
			problems.add(what + " 缺少中文或英文");
		}
	}

	/** 选填文案：可以整项不配，配了就必须中英文都有（不下发 en:null）。 */
	private static void optional(List<String> problems, String what, L10n text) {
		if (text != null && !text.complete()) {
			problems.add(what + " 缺少中文或英文");
		}
	}

	private static List<String> concatIcons(MugsunStartProperties props) {
		List<String> all = new ArrayList<>(props.alwaysOn().stream().map(AlwaysOnModule::icon).toList());
		all.addAll(props.optional().stream().map(OptionalModule::icon).toList());
		return all;
	}

	private static Set<String> ids(List<String> ids) {
		return new LinkedHashSet<>(ids);
	}

	private static List<String> concat(List<String> a, List<String> b) {
		List<String> all = new ArrayList<>(a);
		all.addAll(b);
		return all;
	}

	private static void sameIds(List<String> problems, String what, Set<String> configured, Set<String> expected) {
		Set<String> missing = new LinkedHashSet<>(expected);
		missing.removeAll(configured);
		Set<String> unknown = new LinkedHashSet<>(configured);
		unknown.removeAll(expected);
		if (!missing.isEmpty()) {
			problems.add(what + " 缺少 " + missing);
		}
		if (!unknown.isEmpty()) {
			problems.add(what + " 含 initializr 中不存在的 " + unknown);
		}
	}

}
