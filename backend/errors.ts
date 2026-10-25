export function publicError(text:string):string {
  if(/EFBIG|file too large/i.test(text))return 'O sistema de arquivos ou o armazenamento recusou este tamanho. Escolha um destino compatível com arquivos grandes (por exemplo, NTFS). A aplicação não impõe cota de bytes.';
  if(/EEXIST/i.test(text))return 'Outro arquivo apareceu nesse destino durante a gravação. Ele foi preservado. Prepare uma nova cópia e escolha outro nome ou pasta.';
  if(/ENOSPC|no space left|disk full|not enough space|EDQUOT|disk quota/i.test(text))return 'O armazenamento do backend ficou sem espaço ou atingiu uma cota externa. Libere espaço e prepare novamente; os arquivos incompletos serão removidos.';
  if(/EACCES|EROFS|EIO|permission denied.*(file|output)/i.test(text))return 'Falha de leitura ou escrita no armazenamento do backend. Verifique o disco e as permissões e prepare novamente.';
  if(/stalled/i.test(text))return 'O processo ficou sem avanço observável e foi encerrado. Verifique a origem, o disco e a configuração de inatividade do backend.';
  if(/metadata limit/i.test(text))return 'A resposta de metadados excedeu a proteção de memória. Use uma página menor da playlist ou um link individual.';
  if(/413|too large|size limit|quota|bandwidth.*exceeded/i.test(text))return 'A origem, o proxy ou a hospedagem recusou a transferência por uma restrição externa. A aplicação não impõe limite de tamanho de mídia.';
  if(/Transmissões ao vivo/.test(text))return 'Este motor aceita streams sob demanda (VOD), mas não grava transmissões ao vivo.';
  if(/DRM|encrypted|protected/i.test(text))return 'Mídia protegida ou criptografada sem suporte. Não é possível processá-la nesta instância.';
  if(/private|login|sign in|members.only|age.restrict|403|restricted|not available in your country/i.test(text))return 'Conteúdo privado ou restrito. Use um link público que permita download.';
  if(/format.*not available|Nenhum formato/i.test(text))return 'Nenhum formato público compatível. Confira o link ou tente outro arquivo.';
  if(/404|removed|not found|unavailable/i.test(text))return 'Conteúdo removido ou indisponível. Confira o link.';
  if(/429|too many|rate.limit/i.test(text))return 'A plataforma limitou os pedidos. Tente novamente mais tarde.';
  if(/format.*not available/i.test(text))return 'Este formato não está mais disponível. Analise o link novamente.';
  if(/unsupported url/i.test(text))return 'Este tipo de link ainda não é compatível com o motor.';
  if(/timed out|timeout/i.test(text))return 'Tempo limite atingido. Tente novamente.';
  return 'Não foi possível processar a mídia. Tente outro link público ou novamente mais tarde.';
}
