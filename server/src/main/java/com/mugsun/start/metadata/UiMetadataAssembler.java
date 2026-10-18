package com.mugsun.start.metadata;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mugsun.start.metadata.MugsunStartProperties.FieldRule;
import com.mugsun.start.metadata.MugsunStartProperties.OptionalModule;
import io.spring.initializr.metadata.DefaultMetadataElement;
import io.spring.initializr.metadata.Dependency;
import io.spring.initializr.metadata.InitializrMetadata;
import io.spring.initializr.metadata.InitializrMetadataProvider;
import io.spring.initializr.metadata.SingleSelectCapability;
import io.spring.initializr.metadata.TextCapability;
import io.spring.initializr.metadata.Type;

import org.springframework.stereotype.Component;

/**
 * 组装 {@code GET /api/v1/metadata} 的响应（契约见 start-mugsun-slices §4.1）。
 * <p>
 * metadata 在进程内不变（未启用 initializr 的版本自动更新），因此启动时组装一次、计算 ETag，
 * 同时做一致性校验，配置有误时启动失败而不是在请求时才暴露。
 */
@Component
public class UiMetadataAssembler {

	static final List<String> FIELD_ORDER = List.of("groupId", "artifactId", "name", "packageName", "description",
			"version");

	private final Snapshot snapshot;

	public UiMetadataAssembler(InitializrMetadataProvider provider, MugsunStartProperties props, ObjectMapper mapper) {
		InitializrMetadata metadata = provider.get();
		List<String> problems = MetadataConsistency.check(metadata, props);
		if (!problems.isEmpty()) {
			throw new IllegalStateException("mugsun.start 与 initializr 元数据不一致：" + String.join("；", problems));
		}
		try {
			byte[] json = mapper.writeValueAsBytes(assemble(metadata, props));
			this.snapshot = new Snapshot(json, etag(json));
		}
		catch (JsonProcessingException ex) {
			throw new IllegalStateException("无法序列化 UI metadata", ex);
		}
	}

	public Snapshot snapshot() {
		return this.snapshot;
	}

	static Map<String, Object> assemble(InitializrMetadata metadata, MugsunStartProperties props) {
		Map<String, Object> root = new LinkedHashMap<>();
		root.put("version", props.version());
		Map<String, Object> templates = new LinkedHashMap<>();
		templates.put("boot", props.templates().boot());
		templates.put("pc", props.templates().pc());
		root.put("templates", templates);
		root.put("types", metadata.getTypes().getContent().stream().map((t) -> type(t, props)).toList());
		root.put("fields", fields(metadata, props));
		root.put("bootVersion", select(metadata.getBootVersions()));
		root.put("javaVersion", select(metadata.getJavaVersions()));
		root.put("packaging", select(metadata.getPackagings()));
		root.put("database", database(props));
		Map<String, Object> modules = new LinkedHashMap<>();
		modules.put("alwaysOn", props.alwaysOn().stream().map((m) -> {
			Map<String, Object> o = new LinkedHashMap<>();
			o.put("id", m.id());
			o.put("icon", m.icon());
			o.put("name", m.name());
			o.put("description", m.description());
			o.put("removableIn", m.removableIn());
			return o;
		}).toList());
		modules.put("optional", props.optional().stream().map((m) -> optional(m, metadata)).toList());
		root.put("modules", modules);
		Map<String, Object> post = new LinkedHashMap<>();
		post.put("requirements", props.postGenerate().requirements());
		post.put("commands", props.postGenerate().commands());
		post.put("docs", props.postGenerate().docs());
		root.put("postGenerate", post);
		return root;
	}

	private static Map<String, Object> type(Type t, MugsunStartProperties props) {
		MugsunStartProperties.TypeText text = props.types().get(t.getId());
		Map<String, Object> o = new LinkedHashMap<>();
		o.put("id", t.getId());
		o.put("name", text.name());
		// 中英文缺一项时 MetadataConsistency 已让服务拒绝启动，这里不再回落到 initializr 的单语描述（避免下发 en:null）
		o.put("description", text.description());
		o.put("action", t.getAction());
		o.put("tags", t.getTags());
		if (t.isDefault()) {
			o.put("default", true);
		}
		return o;
	}

	private static Map<String, Object> fields(InitializrMetadata metadata, MugsunStartProperties props) {
		Map<String, TextCapability> defaults = Map.of("groupId", metadata.getGroupId(), "artifactId",
				metadata.getArtifactId(), "name", metadata.getName(), "packageName", metadata.getPackageName(),
				"description", metadata.getDescription(), "version", metadata.getVersion());
		Map<String, Object> fields = new LinkedHashMap<>();
		for (String name : FIELD_ORDER) {
			FieldRule rule = props.fields().get(name);
			Map<String, Object> f = new LinkedHashMap<>();
			if (rule != null && rule.defaultText() != null) {
				f.put("default", rule.defaultText());
			}
			else {
				f.put("default", defaults.get(name).getContent());
			}
			if (rule != null) {
				putIfPresent(f, "pattern", rule.pattern());
				putIfPresent(f, "maxLength", rule.maxLength());
				putIfPresent(f, "required", rule.required());
				putIfPresent(f, "follows", rule.follows());
			}
			fields.put(name, f);
		}
		return fields;
	}

	private static Map<String, Object> select(SingleSelectCapability capability) {
		List<DefaultMetadataElement> values = capability.getContent();
		Map<String, Object> o = new LinkedHashMap<>();
		DefaultMetadataElement def = capability.getDefault();
		o.put("default", (def != null) ? def.getId() : values.get(0).getId());
		o.put("values", values.stream().map((v) -> option(v.getId(), (v.getName() != null) ? v.getName() : v.getId())).toList());
		o.put("readOnly", values.size() == 1);
		return o;
	}

	private static Map<String, Object> database(MugsunStartProperties props) {
		Map<String, Object> o = new LinkedHashMap<>();
		o.put("default", props.database().defaultId());
		o.put("values", props.database().values().stream().map((v) -> option(v.id(), v.name())).toList());
		o.put("readOnly", props.database().values().size() == 1);
		putIfPresent(o, "note", props.database().note());
		return o;
	}

	private static Map<String, Object> optional(OptionalModule m, InitializrMetadata metadata) {
		Dependency dep = metadata.getDependencies().get(m.id());
		Map<String, Object> o = new LinkedHashMap<>();
		o.put("id", m.id());
		o.put("group", m.group());
		o.put("icon", m.icon());
		o.put("name", m.name());
		o.put("description", m.description());
		o.put("default", m.defaultSelected());
		o.put("appliesTo", m.appliesTo());
		o.put("requires", m.requires());
		o.put("conflicts", m.conflicts());
		if (m.notes() != null && m.notes().backendOnly() != null) {
			o.put("notes", Map.of("backendOnly", m.notes().backendOnly()));
		}
		dep.getLinks().stream().filter((l) -> "reference".equals(l.getRel())).findFirst()
			.ifPresent((l) -> o.put("links", Map.of("reference", l.getHref())));
		Map<String, Object> maven = new LinkedHashMap<>();
		maven.put("groupId", dep.getGroupId());
		maven.put("artifactId", dep.getArtifactId());
		o.put("maven", maven);
		Map<String, Object> pc = new LinkedHashMap<>();
		pc.put("dir", m.pc().dir());
		pc.put("npmRemove", m.pc().npmRemove());
		o.put("pc", pc);
		return o;
	}

	private static Map<String, Object> option(String id, String name) {
		Map<String, Object> o = new LinkedHashMap<>();
		o.put("id", id);
		o.put("name", name);
		return o;
	}

	private static void putIfPresent(Map<String, Object> map, String key, Object value) {
		if (value != null) {
			map.put(key, value);
		}
	}

	private static String etag(byte[] json) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(json);
			return "\"" + HexFormat.of().formatHex(digest, 0, 16) + "\"";
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException(ex);
		}
	}

	/** 序列化后的 metadata 与其 ETag。 */
	public record Snapshot(byte[] json, String etag) {

		public String text() {
			return new String(this.json, StandardCharsets.UTF_8);
		}

	}

}
