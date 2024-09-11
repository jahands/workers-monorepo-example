export async function getR2Objects(bucket: R2Bucket, prefix: string): Promise<R2Object[]> {
	const r2Objects: R2Object[] = []

	let hasMore = true
	while (hasMore) {
		const res = await bucket.list({
			prefix,
		})
		hasMore = res.truncated
		r2Objects.push(...res.objects)
	}
	// Sort descending
	r2Objects.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
	return r2Objects
}
