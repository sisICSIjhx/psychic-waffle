// Tipos mínimos de heic-decode (el paquete no publica los suyos).
declare module 'heic-decode' {
	interface ImagenDecodificada {
		width: number;
		height: number;
		data: Uint8ClampedArray;
	}
	interface ImagenHeif {
		width: number;
		height: number;
		decode(): Promise<ImagenDecodificada>;
	}
	interface Decodificar {
		(entrada: { buffer: Uint8Array }): Promise<ImagenDecodificada>;
		all(entrada: { buffer: Uint8Array }): Promise<ImagenHeif[] & { dispose(): void }>;
	}
	const decodificar: Decodificar;
	export default decodificar;
}
