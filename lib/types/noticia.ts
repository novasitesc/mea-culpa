export type Noticia = {
  id: string;
  titulo: string;
  contenido: string;
  imagen_url: string | null;
  imagen_path: string | null;
  visible: boolean;
  created_at: string;
  updated_at: string;
};
