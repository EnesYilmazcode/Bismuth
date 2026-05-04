import { createContext, useContext, useRef, useCallback } from 'react';

interface MeshFilesContextType {
  // Store a mesh file by filename
  setMeshFile: (filename: string, content: Blob) => void;
  // Get a mesh file by filename
  getMeshFile: (filename: string) => Blob | undefined;
  // Check if a mesh file exists
  hasMeshFile: (filename: string) => boolean;
  // Clear all mesh files
  clearMeshFiles: () => void;
}

export const MeshFilesContext = createContext<MeshFilesContextType | undefined>(
  undefined,
);

export function MeshFilesProvider({ children }: { children: React.ReactNode }) {
  // Use ref to avoid re-renders when files are added
  const meshFilesRef = useRef<Map<string, Blob>>(new Map());

  const setMeshFile = useCallback((filename: string, content: Blob) => {
    console.log(`[MeshFiles] Storing: "${filename}" (${content.size} bytes)`);
    meshFilesRef.current.set(filename, content);
  }, []);

  const getMeshFile = useCallback((filename: string): Blob | undefined => {
    return meshFilesRef.current.get(filename);
  }, []);

  const hasMeshFile = useCallback((filename: string): boolean => {
    return meshFilesRef.current.has(filename);
  }, []);

  const clearMeshFiles = useCallback(() => {
    meshFilesRef.current.clear();
  }, []);

  return (
    <MeshFilesContext.Provider
      value={{ setMeshFile, getMeshFile, hasMeshFile, clearMeshFiles }}
    >
      {children}
    </MeshFilesContext.Provider>
  );
}

export function useMeshFiles() {
  const context = useContext(MeshFilesContext);
  if (context === undefined) {
    throw new Error('useMeshFiles must be used within a MeshFilesProvider');
  }
  return context;
}
