package com.mugsun.start.web;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import io.spring.initializr.metadata.InitializrMetadataProvider;
import io.spring.initializr.web.project.ProjectGenerationInvoker;
import io.spring.initializr.web.project.ProjectGenerationResult;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 预览 {@code POST /api/v1/preview}（JSON）与 {@code GET /api/v1/preview}（与 {@code /starter.zip} 同一组 query）（契约 §4.3）。
 * <p>与生成走同一个 {@link ProjectGenerationInvoker} 和同一个校验器（{@link MugsunProjectRequestConverter} →
 * {@link ProjectRequestValidator}），所以错误体与生成完全相同、文件清单与 zip 一致。生成到临时目录、遍历成树后立即清理，不打包。
 * 响应顶层总是带布尔 {@code truncated}。
 * <p>结果缓存与并发上限见 {@link PreviewGuard}：相同请求在缓存有效期内不重复生成，同时在跑的生成数有上限。
 */
@RestController
@RequestMapping("/api/v1/preview")
public class PreviewController {

	private final InitializrMetadataProvider metadataProvider;

	private final ProjectGenerationInvoker<MugsunProjectRequest> invoker;

	private final int maxNodes;

	private final PreviewGuard guard;

	public PreviewController(InitializrMetadataProvider metadataProvider,
			ProjectGenerationInvoker<MugsunProjectRequest> invoker,
			@Value("${mugsun.start.preview.max-nodes:5000}") int maxNodes, PreviewGuard guard) {
		this.metadataProvider = metadataProvider;
		this.invoker = invoker;
		this.maxNodes = maxNodes;
		this.guard = guard;
	}

	/** 与生成控制器一样，先用 metadata 默认值初始化，再绑定 query。 */
	@ModelAttribute("projectRequest")
	public MugsunProjectRequest projectRequest(@RequestHeader Map<String, String> headers) {
		MugsunProjectRequest request = new MugsunProjectRequest();
		request.getParameters().putAll(headers);
		request.initialize(this.metadataProvider.get());
		return request;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	public Map<String, Object> previewGet(@ModelAttribute("projectRequest") MugsunProjectRequest request,
			HttpServletRequest http) {
		return preview(request, http);
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	public Map<String, Object> previewPost(@RequestHeader Map<String, String> headers,
			@RequestBody(required = false) PreviewBody body, HttpServletRequest http) {
		MugsunProjectRequest request = projectRequest(headers);
		if (body != null) {
			body.applyTo(request);
		}
		return preview(request, http);
	}

	private Map<String, Object> preview(MugsunProjectRequest request, HttpServletRequest http) {
		// 缓存命中时不经过校验器，baseDir 的缺省值（= artifactId）要在算缓存键之前补上，否则命中时 root 会是 null
		ProjectRequestValidator.applyBaseDirDefault(request);
		PreviewTree.Result tree = this.guard.get(request, () -> generate(request));
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("requestId", ErrorResponses.requestId(http));
		body.put("root", request.getBaseDir());
		body.put("fileCount", tree.fileCount());
		body.put("dirCount", tree.dirCount());
		body.put("truncated", tree.truncated());
		body.put("tree", tree.tree());
		return body;
	}

	/** 生成到临时目录、遍历成树后立即清理（生成失败时由 {@link CleaningProjectGenerationInvoker} 清理）。 */
	private PreviewTree.Result generate(MugsunProjectRequest request) {
		ProjectGenerationResult result = this.invoker.invokeProjectStructureGeneration(request);
		Path root = result.getRootDirectory();
		try {
			return PreviewTree.build(root, this.maxNodes);
		}
		finally {
			this.invoker.cleanTempFiles(root);
		}
	}

	/**
	 * JSON 请求体：字段与 §4.2 的参数相同，{@code dependencies} 为数组。未传的字段保持 metadata 默认值。
	 */
	public record PreviewBody(String type, String groupId, String artifactId, String name, String description,
			String packageName, String version, List<String> dependencies, String bootVersion, String javaVersion,
			String packaging, String language, String configurationFileFormat, String database, String baseDir) {

		void applyTo(MugsunProjectRequest r) {
			if (this.type != null) {
				r.setType(this.type);
			}
			if (this.groupId != null) {
				r.setGroupId(this.groupId);
			}
			if (this.artifactId != null) {
				r.setArtifactId(this.artifactId);
			}
			if (this.name != null) {
				r.setName(this.name);
			}
			if (this.description != null) {
				r.setDescription(this.description);
			}
			if (this.packageName != null) {
				r.setPackageName(this.packageName);
			}
			if (this.version != null) {
				r.setVersion(this.version);
			}
			if (this.dependencies != null) {
				r.setDependencies(this.dependencies);
			}
			if (this.bootVersion != null) {
				r.setBootVersion(this.bootVersion);
			}
			if (this.javaVersion != null) {
				r.setJavaVersion(this.javaVersion);
			}
			if (this.packaging != null) {
				r.setPackaging(this.packaging);
			}
			if (this.language != null) {
				r.setLanguage(this.language);
			}
			if (this.configurationFileFormat != null) {
				r.setConfigurationFileFormat(this.configurationFileFormat);
			}
			if (this.database != null) {
				r.setDatabase(this.database);
			}
			if (this.baseDir != null) {
				r.setBaseDir(this.baseDir);
			}
		}

	}

}
