import { getUrl, remove, uploadData } from "aws-amplify/storage";

export type UploadedFile = {
	s3Key: string;
	name: string;
	contentType: string | null;
};

// Keys look like uploads/<uuid>/<file name>, matching the storage access rule
// in amplify/storage/resource.ts. The uuid keeps same-named files apart.
export async function uploadFile(file: File): Promise<UploadedFile> {
	const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
	const path = `uploads/${crypto.randomUUID()}/${safeName}`;
	await uploadData({
		path,
		data: file,
		options: { contentType: file.type || undefined },
	}).result;
	return { s3Key: path, name: file.name, contentType: file.type || null };
}

// Signed, short-lived URL for viewing a stored file.
export async function fileUrl(s3Key: string): Promise<string> {
	const { url } = await getUrl({ path: s3Key, options: { expiresIn: 900 } });
	return url.toString();
}

export async function openFile(s3Key: string): Promise<void> {
	// Open the tab synchronously so popup blockers allow it, then point it at
	// the signed URL once it's ready.
	const tab = window.open("about:blank", "_blank");
	const url = await fileUrl(s3Key);
	if (tab) tab.location.href = url;
	else window.location.href = url;
}

export async function deleteFile(s3Key: string): Promise<void> {
	await remove({ path: s3Key });
}

export function fileNameFromKey(s3Key: string): string {
	return s3Key.split("/").pop() ?? s3Key;
}
