#ifndef SEXTAFEIRA_SMC_H
#define SEXTAFEIRA_SMC_H

#include <stdint.h>

/// Acesso ao SMC (chip que controla energia, carga da bateria, sensores e ventoinhas).
/// Ler funciona como usuário comum; escrever exige root (por isso existe o ajudante).

/// Abre a conexão. Devolve 0 se deu certo.
int smc_open(void);
void smc_close(void);

/// Lê uma chave de 4 letras. `bytes` precisa ter 32 posições e `type` 5.
int smc_read(const char *key, uint8_t *bytes, uint32_t *size, char *type);

/// Escreve `size` bytes numa chave (precisa de root).
int smc_write(const char *key, const uint8_t *bytes, uint32_t size);

/// Quantidade de chaves e a chave na posição `index` (`out` com 5 posições).
uint32_t smc_key_count(void);
int smc_key_at(uint32_t index, char *out);

/// Lê a chave como número (flt, fpe2, sp78, ui8/16/32, si8/16).
int smc_read_number(const char *key, double *value);

#endif
