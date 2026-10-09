export interface StaticPage {
  slug: string;
  title: string;
  description: string;
  content: string;
}

export const staticPages: StaticPage[] = [
  {
    slug: 'nosotros',
    title: 'Nosotros',
    description: '870tivo es un colectivo editorial inmaterial dedicado a la literatura, el cine y las artes visuales.',
    content: '870tivo nació como un encuentro inmaterial entre artistas, escritores y cinéfilos de Bogotá y Latinoamérica. Nuestra misión es documentar, crear y diseminar expresiones culturales a través de la escritura, el cine club y la fotografía.',
  },
  {
    slug: 'contacto',
    title: 'Contacto',
    description: 'Ponte en contacto con el colectivo 870tivo.',
    content: 'Para colaboraciones, propuestas editoriales o solo para saludar, escríbenos a 870colectivo@gmail.com',
  },
  {
    slug: 'redes',
    title: 'Redes',
    description: 'Síguenos en nuestras redes sociales.',
    content: 'Encuentra nuestro trabajo en Instagram: @870tivo para el blog y galería, @870raw para fotografía sin editar.',
  },
];
