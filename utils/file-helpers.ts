
/**
 * Lê um arquivo e retorna seu conteúdo como Texto (para códigos) ou Base64 (para imagens).
 */
export async function processFileForAI(file: File): Promise<{ mimeType: string; data: string; type: 'image' | 'text' }> {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (isImage) {
          // Remove prefixo data:image/xyz;base64,
          const base64 = reader.result.split(',')[1];
          resolve({ mimeType: file.type, data: base64, type: 'image' });
        } else {
          resolve({ mimeType: 'text/plain', data: reader.result, type: 'text' });
        }
      }
    };

    reader.onerror = reject;

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file); // Lê como texto puro para injeção de contexto
    }
  });
}

/**
 * Gera uma Blob URL para o conteúdo do arquivo, permitindo o download via botão no chat.
 */
export function generateFileUrl(content: string): string {
  const blob = new Blob([content], { type: 'text/plain' });
  return URL.createObjectURL(blob);
}

/**
 * Formata bytes em tamanho legível (KB, MB)
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
