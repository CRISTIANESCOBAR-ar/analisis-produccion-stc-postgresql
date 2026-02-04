<template>
    <div class="mb-3">
        <label class="block text-sm font-medium text-slate-700 mb-1">Variable</label>
        <select v-model="modelValue" @change="$emit('update:modelValue', modelValue)"
            class="border rounded px-2 py-1 w-full">
            <option v-for="v in variables" :key="v.value" :value="v.value">{{ v.label }}</option>
        </select>
    </div>
</template>

<script setup>
import { toRef } from 'vue'
const props = defineProps({ variables: { type: Array, default: () => [] }, modelValue: { type: String } })
const modelValue = toRef(props, 'modelValue')
</script>

<style scoped>
/* small responsive tweaks */
</style>
