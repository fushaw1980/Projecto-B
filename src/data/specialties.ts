/**
 * Lista de especialidades e categorias para prestadores de serviços em Moçambique.
 * Contém as categorias frequentes e um catálogo expandido de profissões e ofícios.
 */

export interface SpecialtyItem {
  id: string;
  name: string;
  categoryGroup: string;
  iconName?: string;
  frequent?: boolean;
}

export const FREQUENT_CATEGORIES = [
  'Electricista Profissional',
  'Canalizador',
  'Mecânico de Auto',
  'Pedreiro / Pintor',
  'Limpeza Profissional',
  'Diarista / Doméstica',
  'Motorista Particular',
  'Suporte Técnico de TI',
  'Serviços Gerais'
];

export const ALL_SPECIALTIES: SpecialtyItem[] = [
  // Mais Frequentes
  { id: 'eletricista', name: 'Electricista Profissional', categoryGroup: 'Eletricidade', frequent: true },
  { id: 'canalizador', name: 'Canalizador & Redes de Água', categoryGroup: 'Construção', frequent: true },
  { id: 'mecanico_auto', name: 'Mecânico de Auto & Diagnóstico', categoryGroup: 'Automóvel', frequent: true },
  { id: 'pedreiro', name: 'Pedreiro & Alvenaria', categoryGroup: 'Construção', frequent: true },
  { id: 'pintor', name: 'Pintor de Construção Civil', categoryGroup: 'Construção', frequent: true },
  { id: 'limpeza', name: 'Limpeza Profissional & Pós-Obra', categoryGroup: 'Limpeza', frequent: true },
  { id: 'diarista', name: 'Diarista & Empregada Doméstica', categoryGroup: 'Doméstico', frequent: true },
  { id: 'motorista', name: 'Motorista Particular & Chauffeur', categoryGroup: 'Transporte', frequent: true },
  { id: 'ti_suporte', name: 'Suporte Técnico de TI & Redes', categoryGroup: 'Tecnologia', frequent: true },
  
  // Climatização & Refrigeração
  { id: 'refrigeracao_ac', name: 'Técnico de Ar Condicionado (AC)', categoryGroup: 'Climatização' },
  { id: 'geleiras', name: 'Reparação de Geleiras & Arcas', categoryGroup: 'Climatização' },
  
  // Carpintaria & Serralharia
  { id: 'carpinteiro', name: 'Carpinteiro & Portas de Madeira', categoryGroup: 'Carpintaria' },
  { id: 'marceneiro', name: 'Marceneiro & Móveis por Medida', categoryGroup: 'Carpintaria' },
  { id: 'serralheiro', name: 'Serralheiro & Portões de Ferro', categoryGroup: 'Serralharia' },
  { id: 'soldador', name: 'Soldador Especializado', categoryGroup: 'Serralharia' },
  { id: 'vidraceiro', name: 'Vidraceiro & Instalação de Alumínio', categoryGroup: 'Construção' },
  { id: 'estofador', name: 'Estofador de Sofás & Automóvel', categoryGroup: 'Design & Móveis' },
  { id: 'gesso_tectos', name: 'Tectos Falsos & Gesso / Pladur', categoryGroup: 'Construção' },
  { id: 'montador_moveis', name: 'Montador de Mobílias e Móveis', categoryGroup: 'Design & Móveis' },

  // Instalações Técnicas & Eletrónica
  { id: 'antenista', name: 'Instalação de Antenas DStv, Gotv & TVCabo', categoryGroup: 'Eletrónica' },
  { id: 'cctv_alarmes', name: 'Instalação de Câmeras CCTV & Alarmes', categoryGroup: 'Segurança' },
  { id: 'eletrodomesticos', name: 'Reparação de Máquinas de Lavar e Microondas', categoryGroup: 'Eletrónica' },
  { id: 'reparacao_tv', name: 'Técnico de TV Smart & Som', categoryGroup: 'Eletrónica' },
  { id: 'reparacao_celular', name: 'Reparação de Telemóveis & Ecrãs', categoryGroup: 'Tecnologia' },

  // Jardim, Exterior & Pragas
  { id: 'jardineiro', name: 'Jardinagem, Paisagismo & Poda', categoryGroup: 'Jardim' },
  { id: 'piscineiro', name: 'Tratamento & Manutenção de Piscinas', categoryGroup: 'Exterior' },
  { id: 'fumigacao', name: 'Desinfestação & Controlo de Pragas', categoryGroup: 'Limpeza' },

  // Automóvel Avançado
  { id: 'eletricista_auto', name: 'Electricista Auto & Baterias', categoryGroup: 'Automóvel' },
  { id: 'batechapas', name: 'Bate-Chapas & Pintura Automóvel', categoryGroup: 'Automóvel' },
  { id: 'lavagem_auto', name: 'Lavagem Automóvel ao Domicílio', categoryGroup: 'Automóvel' },
  { id: 'mudancas_fretes', name: 'Transporte de Cargas & Mudanças', categoryGroup: 'Transporte' },

  // Serviços Pessoais & Eventos
  { id: 'seguranca_vigia', name: 'Segurança Privado & Vigia', categoryGroup: 'Segurança' },
  { id: 'cozinheiro', name: 'Cozinheiro(a) a Domicílio & Eventos', categoryGroup: 'Alimentação' },
  { id: 'confeitaria', name: 'Pasteleiro(a) & Bolos Decorados', categoryGroup: 'Alimentação' },
  { id: 'babysitter', name: 'Babysitter & Cuidadora de Crianças', categoryGroup: 'Doméstico' },
  { id: 'cuidador_idosos', name: 'Cuidador(a) de Idosos ao Domicílio', categoryGroup: 'Saúde & Cuidado' },
  { id: 'alfaiate_costura', name: 'Costureiro(a) & Alfaiate', categoryGroup: 'Moda' },
  { id: 'manicure_pedicure', name: 'Manicure, Pedicure & Unhas de Gel', categoryGroup: 'Beleza' },
  { id: 'cabeleireiro', name: 'Cabeleireiro(a) & Tranças ao Domicílio', categoryGroup: 'Beleza' },
  { id: 'fotografo', name: 'Fotógrafo(a) & Filmagem de Eventos', categoryGroup: 'Eventos' },
  { id: 'organizador_eventos', name: 'Decoração & Organização de Eventos', categoryGroup: 'Eventos' },
  { id: 'servicos_gerais', name: 'Serviços Gerais & Reparações Rápidas', categoryGroup: 'Gerais', frequent: true }
];
