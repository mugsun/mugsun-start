package com.mugsun.start.web;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tomcat 在进入 Spring MVC 之前就拒绝的请求（请求行里有非法字符），也要返回统一错误体 + X-Request-Id。
 * 用原始 socket 发请求：HTTP 客户端库会先把非法字符编码掉。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TomcatRejectionTests {

	@LocalServerPort
	private int port;

	private String raw(String requestLine) throws Exception {
		try (Socket socket = new Socket("127.0.0.1", this.port)) {
			socket.setSoTimeout(10_000);
			OutputStream out = socket.getOutputStream();
			out.write((requestLine + "\r\nHost: localhost\r\nAccept: */*\r\nConnection: close\r\n\r\n")
				.getBytes(StandardCharsets.ISO_8859_1));
			out.flush();
			InputStream in = socket.getInputStream();
			ByteArrayOutputStream buf = new ByteArrayOutputStream();
			in.transferTo(buf);
			return buf.toString(StandardCharsets.UTF_8);
		}
	}

	@Test
	@DisplayName("请求行含非法字符：Tomcat 层 400 也是统一 JSON 错误体，带 X-Request-Id 与 charset")
	void illegalCharacterInRequestLine() throws Exception {
		String response = raw("GET /api/v1/metadata?q=a|b{c} HTTP/1.1");
		String head = response.substring(0, response.indexOf("\r\n\r\n"));
		String body = response.substring(response.indexOf("\r\n\r\n") + 4);
		assertThat(head).startsWith("HTTP/1.1 400");
		assertThat(head.toLowerCase()).contains("content-type: application/json;charset=utf-8");
		assertThat(head).containsPattern("(?im)^X-Request-Id: [0-9A-Z]{26}$");
		// 可能是 chunked 编码：取第一个 { 到最后一个 }
		JsonNode json = new ObjectMapper().readTree(body.substring(body.indexOf('{'), body.lastIndexOf('}') + 1));
		assertThat(json.path("code").asText()).isEqualTo("INVALID_PARAMETER");
		assertThat(json.path("requestId").asText()).isNotBlank();
		assertThat(head).contains("X-Request-Id: " + json.path("requestId").asText());
	}

}
