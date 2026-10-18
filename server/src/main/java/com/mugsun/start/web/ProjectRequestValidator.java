package com.mugsun.start.web;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import javax.lang.model.SourceVersion;

import com.mugsun.start.metadata.MugsunStartProperties;
import com.mugsun.start.metadata.MugsunStartProperties.FieldRule;
import com.mugsun.start.metadata.MugsunStartProperties.OptionalModule;
import io.spring.initializr.metadata.DefaultMetadataElement;
import io.spring.initializr.metadata.InitializrMetadata;
import io.spring.initializr.metadata.InitializrMetadataProvider;
import io.spring.initializr.metadata.MetadataElement;
import io.spring.initializr.metadata.SingleSelectCapability;
import io.spring.initializr.metadata.Type;
import io.spring.initializr.web.project.ProjectRequest;

import org.springframework.stereotype.Component;

/**
 * 生成与预览共用的参数校验（契约 §4.2、§4.4）。规则来源：
 * <ul>
 * <li>字段正则和长度：{@code mugsun.start.fields}（与 {@code /api/v1/metadata} 下发的完全一致）；</li>
 * <li>包名每一段不能是 Java 关键字或 true/false/null；</li>
 * <li>language、configurationFileFormat、bootVersion、javaVersion、packaging、database 可不传，传了必须等于默认值；</li>
 * <li>常驻模块 id 传了会被忽略；可选模块检查 appliesTo、requires、conflicts。</li>
 * </ul>
 * 校验通过后会改写请求：去掉常驻模块 id，补上 version 与 baseDir（=artifactId）的默认值。
 */
@Component
public class ProjectRequestValidator {

	static final String DEFAULT_DATABASE = "postgresql";

	private static final Pattern VERSION = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$");

	private static final Pattern BASE_DIR = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$");

	private static final Set<String> LITERALS = Set.of("true", "false", "null");

	private final InitializrMetadataProvider metadataProvider;

	private final MugsunStartProperties props;

	public ProjectRequestValidator(InitializrMetadataProvider metadataProvider, MugsunStartProperties props) {
		this.metadataProvider = metadataProvider;
		this.props = props;
	}

	public void validate(ProjectRequest request, String database) {
		InitializrMetadata metadata = this.metadataProvider.get();
		List<FieldProblem> invalid = new ArrayList<>();
		text(invalid, "groupId", request.getGroupId());
		text(invalid, "artifactId", request.getArtifactId());
		text(invalid, "name", request.getName());
		text(invalid, "description", request.getDescription());
		packageName(invalid, request);
		if (!blank(request.getVersion()) && !VERSION.matcher(request.getVersion()).matches()) {
			invalid.add(new FieldProblem("version", "pattern"));
		}
		if (!blank(request.getBaseDir())
				&& (!BASE_DIR.matcher(request.getBaseDir()).matches() || request.getBaseDir().contains(".."))) {
			invalid.add(new FieldProblem("baseDir", "pattern"));
		}
		raise(ErrorCode.INVALID_PARAMETER, invalid);

		List<FieldProblem> unsupported = new ArrayList<>();
		List<String> typeIds = metadata.getTypes().getContent().stream().map(Type::getId).toList();
		if (!blank(request.getType()) && !typeIds.contains(request.getType())) {
			unsupported.add(new FieldProblem("type", "unsupported", request.getType()));
		}
		option(unsupported, "language", request.getLanguage(), metadata.getLanguages());
		option(unsupported, "configurationFileFormat", request.getConfigurationFileFormat(),
				metadata.getConfigurationFileFormats());
		option(unsupported, "bootVersion", request.getBootVersion(), metadata.getBootVersions());
		option(unsupported, "javaVersion", request.getJavaVersion(), metadata.getJavaVersions());
		option(unsupported, "packaging", request.getPackaging(), metadata.getPackagings());
		String db = blank(database) ? databaseDefault() : database;
		if (this.props.database().values().stream().noneMatch((o) -> o.id().equals(db))) {
			unsupported.add(new FieldProblem("database", "unsupported", db));
		}
		raise(ErrorCode.UNSUPPORTED_OPTION, unsupported);

		request.setDependencies(dependencies(request, metadata));
		if (blank(request.getVersion())) {
			request.setVersion(metadata.getVersion().getContent());
		}
		if (blank(request.getBaseDir())) {
			request.setBaseDir(request.getArtifactId());
		}
	}

	public String databaseDefault() {
		return (this.props.database() != null && this.props.database().defaultId() != null)
				? this.props.database().defaultId() : DEFAULT_DATABASE;
	}

	private List<String> dependencies(ProjectRequest request, InitializrMetadata metadata) {
		Set<String> alwaysOn = new LinkedHashSet<>(
				metadata.getDependencies().getContent().get(0).getContent().stream().map(MetadataElement::getId).toList());
		Map<String, OptionalModule> optional = new LinkedHashMap<>();
		this.props.optional().forEach((m) -> optional.put(m.id(), m));
		Set<String> selected = new LinkedHashSet<>();
		List<FieldProblem> unknown = new ArrayList<>();
		for (String raw : (request.getDependencies() != null) ? request.getDependencies() : List.<String>of()) {
			String id = (raw != null) ? raw.trim() : "";
			if (id.isEmpty() || alwaysOn.contains(id)) {
				continue;
			}
			if (optional.containsKey(id)) {
				selected.add(id);
			}
			else {
				unknown.add(new FieldProblem("dependencies", "unknown", id));
			}
		}
		raise(ErrorCode.UNKNOWN_DEPENDENCY, unknown);

		String type = blank(request.getType()) ? defaultType(metadata) : request.getType();
		raise(ErrorCode.DEPENDENCY_NOT_APPLICABLE, selected.stream()
			.filter((id) -> !optional.get(id).appliesTo().contains(type))
			.map((id) -> new FieldProblem("dependencies", "notApplicable", id, type))
			.toList());
		List<FieldProblem> requires = new ArrayList<>();
		List<FieldProblem> conflicts = new ArrayList<>();
		for (String id : selected) {
			OptionalModule m = optional.get(id);
			m.requires().stream().filter((r) -> !selected.contains(r))
				.forEach((r) -> requires.add(new FieldProblem("dependencies", "requires", id, r)));
			m.conflicts().stream().filter(selected::contains)
				.forEach((c) -> conflicts.add(new FieldProblem("dependencies", "conflicts", id, c)));
		}
		raise(ErrorCode.DEPENDENCY_CONFLICT, conflicts);
		raise(ErrorCode.DEPENDENCY_REQUIRES, requires);
		return new ArrayList<>(selected);
	}

	private static String defaultType(InitializrMetadata metadata) {
		return metadata.getTypes().getContent().stream().filter(DefaultMetadataElement::isDefault)
			.map(Type::getId).findFirst().orElse(null);
	}

	private void text(List<FieldProblem> problems, String field, String value) {
		FieldRule rule = this.props.fields().get(field);
		if (rule == null) {
			return;
		}
		if (blank(value)) {
			if (Boolean.TRUE.equals(rule.required())) {
				problems.add(new FieldProblem(field, "required"));
			}
			return;
		}
		if (rule.maxLength() != null && value.length() > rule.maxLength()) {
			problems.add(new FieldProblem(field, "maxLength", rule.maxLength()));
		}
		else if (rule.pattern() != null && !Pattern.compile(rule.pattern()).matcher(value).matches()) {
			problems.add(new FieldProblem(field, "pattern"));
		}
	}

	private void packageName(List<FieldProblem> problems, ProjectRequest request) {
		String packageName = request.getPackageName();
		if (blank(packageName)) {
			return;
		}
		// 未传 packageName 时 ProjectRequest#getPackageName 返回 groupId.artifactId，initializr 随后会转小写、去掉连字符；
		// 这种推导值只检查关键字（groupId、artifactId 自身的格式已单独校验），推导结果同样不能含关键字
		String derived = (blank(request.getGroupId()) || blank(request.getArtifactId())) ? null
				: request.getGroupId() + "." + request.getArtifactId();
		if (packageName.equals(derived)) {
			keywords(problems, derived.replace("-", "").toLowerCase(Locale.ROOT));
			return;
		}
		int before = problems.size();
		text(problems, "packageName", packageName);
		if (problems.size() == before) {
			keywords(problems, packageName);
		}
	}

	private static void keywords(List<FieldProblem> problems, String packageName) {
		for (String segment : packageName.split("\\.")) {
			if (LITERALS.contains(segment) || SourceVersion.isKeyword(segment, SourceVersion.RELEASE_21)) {
				problems.add(new FieldProblem("packageName", "keyword", segment));
				return;
			}
		}
	}

	private static void option(List<FieldProblem> problems, String field, String value,
			SingleSelectCapability capability) {
		if (blank(value)) {
			return;
		}
		DefaultMetadataElement def = capability.getDefault();
		String expected = (def != null) ? def.getId() : null;
		if (!value.equals(expected)) {
			problems.add(new FieldProblem(field, "unsupported", value));
		}
	}

	private static void raise(ErrorCode code, List<FieldProblem> problems) {
		if (!problems.isEmpty()) {
			throw new MugsunRequestException(code, problems);
		}
	}

	private static boolean blank(String value) {
		return value == null || value.isBlank();
	}

}
