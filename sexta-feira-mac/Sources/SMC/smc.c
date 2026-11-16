#include "smc.h"
#include <IOKit/IOKitLib.h>
#include <mach/mach.h>
#include <string.h>

#define KERNEL_INDEX_SMC 2
#define SMC_CMD_READ_BYTES 5
#define SMC_CMD_WRITE_BYTES 6
#define SMC_CMD_READ_INDEX 8
#define SMC_CMD_READ_KEYINFO 9

typedef struct {
    char major;
    char minor;
    char build;
    char reserved[1];
    uint16_t release;
} SMCVers;

typedef struct {
    uint16_t version;
    uint16_t length;
    uint32_t cpuPLimit;
    uint32_t gpuPLimit;
    uint32_t memPLimit;
} SMCPLimit;

typedef struct {
    uint32_t dataSize;
    uint32_t dataType;
    char dataAttributes;
} SMCKeyInfo;

typedef struct {
    uint32_t key;
    SMCVers vers;
    SMCPLimit pLimitData;
    SMCKeyInfo keyInfo;
    char result;
    char status;
    char data8;
    uint32_t data32;
    uint8_t bytes[32];
} SMCParam;

static io_connect_t conn = 0;

static uint32_t to_u32(const char *s) {
    return ((uint32_t)(uint8_t)s[0] << 24) | ((uint32_t)(uint8_t)s[1] << 16) |
           ((uint32_t)(uint8_t)s[2] << 8) | (uint32_t)(uint8_t)s[3];
}

static void from_u32(uint32_t v, char *out) {
    out[0] = (char)((v >> 24) & 0xff);
    out[1] = (char)((v >> 16) & 0xff);
    out[2] = (char)((v >> 8) & 0xff);
    out[3] = (char)(v & 0xff);
    out[4] = 0;
}

int smc_open(void) {
    if (conn) return 0;
    io_service_t svc = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSMC"));
    if (!svc) return -1;
    kern_return_t kr = IOServiceOpen(svc, mach_task_self(), 0, &conn);
    IOObjectRelease(svc);
    if (kr != KERN_SUCCESS) { conn = 0; return -1; }
    return 0;
}

void smc_close(void) {
    if (conn) { IOServiceClose(conn); conn = 0; }
}

static int call(SMCParam *in, SMCParam *out) {
    size_t outSize = sizeof(SMCParam);
    kern_return_t kr = IOConnectCallStructMethod(conn, KERNEL_INDEX_SMC, in, sizeof(SMCParam), out, &outSize);
    if (kr != KERN_SUCCESS) return -1;
    if (out->result != 0) return -2;
    return 0;
}

static int key_info(uint32_t key, SMCKeyInfo *info) {
    SMCParam in, out;
    memset(&in, 0, sizeof in);
    memset(&out, 0, sizeof out);
    in.key = key;
    in.data8 = SMC_CMD_READ_KEYINFO;
    int r = call(&in, &out);
    if (r) return r;
    *info = out.keyInfo;
    return 0;
}

int smc_read(const char *key, uint8_t *bytes, uint32_t *size, char *type) {
    if (smc_open()) return -1;
    uint32_t k = to_u32(key);
    SMCKeyInfo info;
    if (key_info(k, &info)) return -1;
    SMCParam in, out;
    memset(&in, 0, sizeof in);
    memset(&out, 0, sizeof out);
    in.key = k;
    in.keyInfo.dataSize = info.dataSize;
    in.data8 = SMC_CMD_READ_BYTES;
    if (call(&in, &out)) return -1;
    uint32_t n = info.dataSize > 32 ? 32 : info.dataSize;
    memcpy(bytes, out.bytes, n);
    *size = n;
    from_u32(info.dataType, type);
    return 0;
}

int smc_write(const char *key, const uint8_t *bytes, uint32_t size) {
    if (smc_open()) return -1;
    uint32_t k = to_u32(key);
    SMCKeyInfo info;
    if (key_info(k, &info)) return -1;
    if (size != info.dataSize || size > 32) return -3;
    SMCParam in, out;
    memset(&in, 0, sizeof in);
    memset(&out, 0, sizeof out);
    in.key = k;
    in.data8 = SMC_CMD_WRITE_BYTES;
    in.keyInfo.dataSize = size;
    memcpy(in.bytes, bytes, size);
    return call(&in, &out);
}

uint32_t smc_key_count(void) {
    uint8_t b[32];
    uint32_t size = 0;
    char type[5];
    if (smc_read("#KEY", b, &size, type) || size < 4) return 0;
    return ((uint32_t)b[0] << 24) | ((uint32_t)b[1] << 16) | ((uint32_t)b[2] << 8) | (uint32_t)b[3];
}

int smc_key_at(uint32_t index, char *out) {
    if (smc_open()) return -1;
    SMCParam in, o;
    memset(&in, 0, sizeof in);
    memset(&o, 0, sizeof o);
    in.data8 = SMC_CMD_READ_INDEX;
    in.data32 = index;
    if (call(&in, &o)) return -1;
    from_u32(o.key, out);
    return 0;
}

int smc_read_number(const char *key, double *value) {
    uint8_t b[32];
    uint32_t size = 0;
    char type[5];
    if (smc_read(key, b, &size, type)) return -1;
    if (!strcmp(type, "flt ") && size == 4) { float f; memcpy(&f, b, 4); *value = f; return 0; }
    if (!strcmp(type, "fpe2") && size == 2) { *value = ((b[0] << 8) | b[1]) / 4.0; return 0; }
    if (!strcmp(type, "sp78") && size == 2) { *value = (int16_t)((b[0] << 8) | b[1]) / 256.0; return 0; }
    if (!strcmp(type, "ui8 ") && size >= 1) { *value = b[0]; return 0; }
    if (!strcmp(type, "si8 ") && size >= 1) { *value = (int8_t)b[0]; return 0; }
    if (!strcmp(type, "ui16") && size == 2) { *value = (b[0] << 8) | b[1]; return 0; }
    if (!strcmp(type, "si16") && size == 2) { *value = (int16_t)((b[0] << 8) | b[1]); return 0; }
    if (!strcmp(type, "ui32") && size == 4) {
        *value = (double)(((uint32_t)b[0] << 24) | ((uint32_t)b[1] << 16) | ((uint32_t)b[2] << 8) | b[3]);
        return 0;
    }
    return -2;
}
