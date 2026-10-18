package com.mugsun.start.web;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * 把生成到临时目录的工程遍历成预览树（契约 §4.3）。
 * <ul>
 * <li>节点：{@code name}、{@code path}（相对生成根目录、以 / 分隔，跨请求稳定）、{@code type}（dir/file），文件带 {@code size}；</li>
 * <li>排序：目录在前，同类按名称升序；</li>
 * <li>节点总数超过上限时按层展开，放不下子节点的目录只给 {@code childCount}，同时 {@code truncated=true}。</li>
 * </ul>
 */
final class PreviewTree {

	private static final Comparator<Entry> ORDER = Comparator.comparing((Entry e) -> !e.dir())
		.thenComparing(Entry::name);

	private PreviewTree() {
	}

	/**
	 * 结果：顶层节点、文件数、目录数、是否截断。
	 * <p>树在构造时深拷贝成不可变结构（节点 Map 保持字段顺序），结果会进缓存、被多个请求共享，
	 * 任何一方改动都会抛 {@link UnsupportedOperationException}，不会污染其他请求的响应。
	 */
	record Result(List<Map<String, Object>> tree, int fileCount, int dirCount, boolean truncated) {

		Result {
			tree = freezeList(tree);
		}

	}

	@SuppressWarnings("unchecked")
	private static Object freeze(Object value) {
		if (value instanceof Map<?, ?> map) {
			return freezeMap((Map<String, Object>) map);
		}
		if (value instanceof List<?> list) {
			return freezeList((List<Map<String, Object>>) list);
		}
		return value;
	}

	private static Map<String, Object> freezeMap(Map<String, Object> map) {
		Map<String, Object> copy = new LinkedHashMap<>();
		map.forEach((k, v) -> copy.put(k, freeze(v)));
		return Collections.unmodifiableMap(copy);
	}

	@SuppressWarnings("unchecked")
	private static <T> List<T> freezeList(List<T> list) {
		List<T> copy = new ArrayList<>(list.size());
		for (T item : list) {
			copy.add((T) freeze(item));
		}
		return Collections.unmodifiableList(copy);
	}

	private record Entry(String name, String path, boolean dir, long size, List<Entry> children) {
	}

	static Result build(Path root, int maxNodes) {
		List<Entry> top = children(root, root);
		int[] counts = new int[2];
		count(top, counts);
		int total = counts[0] + counts[1];
		Map<Entry, Map<String, Object>> rendered = new LinkedHashMap<>();
		List<Map<String, Object>> tree = new ArrayList<>();
		boolean truncated = false;
		int emitted = 0;
		Deque<Entry> queue = new ArrayDeque<>();
		for (Entry e : top) {
			Map<String, Object> node = node(e);
			rendered.put(e, node);
			tree.add(node);
			emitted++;
			if (e.dir()) {
				queue.add(e);
			}
		}
		// 广度优先：先保证上层完整，深层放不下时折叠成 childCount
		while (!queue.isEmpty()) {
			Entry dir = queue.poll();
			Map<String, Object> node = rendered.get(dir);
			if (total > maxNodes && emitted + dir.children().size() > maxNodes) {
				node.put("childCount", dir.children().size());
				truncated = truncated || !dir.children().isEmpty();
				continue;
			}
			List<Map<String, Object>> kids = new ArrayList<>(dir.children().size());
			for (Entry c : dir.children()) {
				Map<String, Object> child = node(c);
				rendered.put(c, child);
				kids.add(child);
				emitted++;
				if (c.dir()) {
					queue.add(c);
				}
			}
			node.put("children", kids);
		}
		return new Result(tree, counts[0], counts[1], truncated);
	}

	private static Map<String, Object> node(Entry e) {
		Map<String, Object> n = new LinkedHashMap<>();
		n.put("name", e.name());
		n.put("path", e.path());
		n.put("type", e.dir() ? "dir" : "file");
		if (!e.dir()) {
			n.put("size", e.size());
		}
		return n;
	}

	private static void count(List<Entry> entries, int[] counts) {
		for (Entry e : entries) {
			if (e.dir()) {
				counts[1]++;
				count(e.children(), counts);
			}
			else {
				counts[0]++;
			}
		}
	}

	private static List<Entry> children(Path root, Path dir) {
		try (Stream<Path> stream = Files.list(dir)) {
			return stream.map((p) -> entry(root, p)).sorted(ORDER).toList();
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

	private static Entry entry(Path root, Path p) {
		String path = root.relativize(p).toString().replace('\\', '/');
		String name = p.getFileName().toString();
		try {
			if (Files.isDirectory(p)) {
				return new Entry(name, path, true, 0, children(root, p));
			}
			return new Entry(name, path, false, Files.size(p), List.of());
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

}
