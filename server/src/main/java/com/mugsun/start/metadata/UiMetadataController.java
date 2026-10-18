package com.mugsun.start.metadata;

import java.time.Duration;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

/**
 * Web UI 使用的 metadata。initializr 原生的 {@code /metadata/client} 保持标准格式，供 IDE 和 curl 使用。
 */
@RestController
@RequestMapping("/api/v1")
public class UiMetadataController {

	private static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic();

	private final UiMetadataAssembler assembler;

	public UiMetadataController(UiMetadataAssembler assembler) {
		this.assembler = assembler;
	}

	@GetMapping(path = "/metadata", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<byte[]> metadata(WebRequest request) {
		UiMetadataAssembler.Snapshot snapshot = this.assembler.snapshot();
		if (request.checkNotModified(snapshot.etag())) {
			return ResponseEntity.status(304).eTag(snapshot.etag()).cacheControl(CACHE).build();
		}
		return ResponseEntity.ok()
			.eTag(snapshot.etag())
			.cacheControl(CACHE)
			.header(HttpHeaders.CONTENT_TYPE, "application/json;charset=UTF-8")
			.body(snapshot.json());
	}

}
