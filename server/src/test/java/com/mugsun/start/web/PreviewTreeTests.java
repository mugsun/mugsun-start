package com.mugsun.start.web;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;

class PreviewTreeTests {

	/** demo/{pom.xml, a.txt, src/{main/{App.java}, z.txt}} → 7 个节点（2 文件夹 + demo 本身另计） */
	private static Path sample(Path root) throws Exception {
		Path demo = Files.createDirectories(root.resolve("demo"));
		Files.writeString(demo.resolve("pom.xml"), "<project/>");
		Files.writeString(demo.resolve("a.txt"), "a");
		Path main = Files.createDirectories(demo.resolve("src/main"));
		Files.writeString(main.resolve("App.java"), "class App {}");
		Files.writeString(demo.resolve("src/z.txt"), "z");
		return root;
	}

	@SuppressWarnings("unchecked")
	private static List<Map<String, Object>> children(Map<String, Object> node) {
		return (List<Map<String, Object>>) node.get("children");
	}

	@Test
	@DisplayName("完整树：目录在前、按名称升序，path 相对根目录，文件带 size，计数正确")
	void fullTree(@TempDir Path tmp) throws Exception {
		PreviewTree.Result r = PreviewTree.build(sample(tmp), 5000);
		assertThat(r.truncated()).isFalse();
		assertThat(r.fileCount()).isEqualTo(4);
		assertThat(r.dirCount()).isEqualTo(3);
		Map<String, Object> demo = r.tree().get(0);
		assertThat(demo).containsEntry("path", "demo").containsEntry("type", "dir");
		assertThat(children(demo)).extracting((n) -> n.get("name")).containsExactly("src", "a.txt", "pom.xml");
		Map<String, Object> pom = children(demo).get(2);
		assertThat(pom).containsEntry("path", "demo/pom.xml").containsEntry("size", 10L);
		Map<String, Object> src = children(demo).get(0);
		assertThat(children(src)).extracting((n) -> n.get("path")).containsExactly("demo/src/main", "demo/src/z.txt");
	}

	@Test
	@DisplayName("超过上限：上层完整，放不下的目录只给 childCount，truncated=true；计数仍是全量")
	void truncated(@TempDir Path tmp) throws Exception {
		PreviewTree.Result r = PreviewTree.build(sample(tmp), 4);
		assertThat(r.truncated()).isTrue();
		assertThat(r.fileCount()).isEqualTo(4);
		assertThat(r.dirCount()).isEqualTo(3);
		Map<String, Object> demo = r.tree().get(0);
		assertThat(children(demo)).hasSize(3);
		Map<String, Object> src = children(demo).get(0);
		assertThat(src).doesNotContainKey("children").containsEntry("childCount", 2);
	}

	@Test
	@DisplayName("恰好等于上限不算截断")
	void exactlyAtLimit(@TempDir Path tmp) throws Exception {
		PreviewTree.Result r = PreviewTree.build(sample(tmp), 7);
		assertThat(r.truncated()).isFalse();
	}

}
