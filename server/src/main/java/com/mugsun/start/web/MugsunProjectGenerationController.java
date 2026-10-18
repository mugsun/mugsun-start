package com.mugsun.start.web;

import java.io.IOException;
import java.util.Map;

import io.spring.initializr.metadata.InitializrMetadataProvider;
import io.spring.initializr.web.controller.ProjectGenerationController;
import io.spring.initializr.web.project.InvalidProjectRequestException;
import io.spring.initializr.web.project.ProjectGenerationInvoker;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 替换 initializr 默认的生成控制器：请求类型为 {@link MugsunProjectRequest}，参数错误时返回统一错误 JSON
 * （上游默认是 {@code sendError(400)}）；{@code /starter.zip}、{@code /starter.tgz} 受 {@link PreviewGuard} 的并发上限约束。
 */
public class MugsunProjectGenerationController extends ProjectGenerationController<MugsunProjectRequest> {

	private static final Logger log = LoggerFactory.getLogger(MugsunProjectGenerationController.class);

	private final ErrorResponses errors;

	private final PreviewGuard guard;

	public MugsunProjectGenerationController(InitializrMetadataProvider metadataProvider,
			ProjectGenerationInvoker<MugsunProjectRequest> invoker, ErrorResponses errors, PreviewGuard guard) {
		super(metadataProvider, invoker);
		this.errors = errors;
		this.guard = guard;
	}

	/**
	 * 下载 zip：与预览共用并发名额（{@link PreviewGuard#withPermit}），名额用完时 429 {@code RATE_LIMITED} + Retry-After。
	 * 文件名与 zip 内的根目录一致，取 baseDir（缺省 = artifactId，见 {@link ProjectRequestValidator#applyBaseDirDefault}）；
	 * initializr 默认用 artifactId，传了不同的 baseDir 时两者会不一致。映射注解（{@code /starter.zip}）继承自父类方法。
	 */
	@Override
	public ResponseEntity<byte[]> springZip(MugsunProjectRequest request) throws IOException {
		return withFileName(this.guard.withPermit(() -> super.springZip(request)), request, ".zip");
	}

	/** 下载 tgz：同上。 */
	@Override
	public ResponseEntity<byte[]> springTgz(MugsunProjectRequest request) throws IOException {
		return withFileName(this.guard.withPermit(() -> super.springTgz(request)), request, ".tar.gz");
	}

	/** 把 Content-Disposition 的文件名换成 baseDir + 扩展名；baseDir 已按 §4.2 校验（字母数字与 ._-），无需转义。 */
	static ResponseEntity<byte[]> withFileName(ResponseEntity<byte[]> response, MugsunProjectRequest request,
			String extension) {
		String base = request.getBaseDir();
		if (base == null || base.isBlank()) {
			base = request.getArtifactId();
		}
		if (base == null || base.isBlank()) {
			return response;
		}
		HttpHeaders headers = new HttpHeaders();
		headers.putAll(response.getHeaders());
		headers.setContentDisposition(ContentDisposition.attachment().filename(base + extension).build());
		return new ResponseEntity<>(response.getBody(), headers, response.getStatusCode());
	}

	@Override
	public MugsunProjectRequest projectRequest(Map<String, String> headers) {
		MugsunProjectRequest request = new MugsunProjectRequest();
		request.getParameters().putAll(headers);
		request.initialize(getMetadata());
		return request;
	}

	@Override
	@ExceptionHandler(InvalidProjectRequestException.class)
	public void invalidProjectRequest(HttpServletResponse response, InvalidProjectRequestException ex)
			throws IOException {
		MugsunRequestException mugsun = (ex instanceof MugsunRequestException m) ? m
				: new MugsunRequestException(ErrorCode.INVALID_PARAMETER,
						java.util.List.of(new FieldProblem("request", "invalid")));
		// initializr 原生异常的文本（可能含类名、内部取值）只进日志，不进响应 message
		log.info("生成请求被拒绝：{} {}{}", mugsun.code(), mugsun.problems().stream().map(FieldProblem::field).toList(),
				(mugsun == ex) ? "" : " cause=" + ex.getMessage());
		this.errors.write(currentRequest(), response, mugsun);
	}

	private static HttpServletRequest currentRequest() {
		return (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)
				? attrs.getRequest() : null;
	}

}
