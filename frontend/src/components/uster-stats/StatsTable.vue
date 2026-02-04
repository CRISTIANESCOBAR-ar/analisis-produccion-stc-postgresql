<template>
    <div class="overflow-auto max-h-96">
        <table class="w-full table-auto text-sm border">
            <thead class="sticky top-0 bg-slate-50">
                <tr>
                    <th class="px-3 py-2 text-left">TESTNR</th>
                    <th class="px-3 py-2 text-right">n</th>
                    <th class="px-3 py-2 text-right">Media</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="s in stats" :key="s.testnr" class="hover:bg-slate-50">
                    <td class="px-3 py-2 font-mono">{{ s.testnr }}</td>
                    <td class="px-3 py-2 text-right">{{ s.n }}</td>
                    <td class="px-3 py-2 text-right">{{ s.mean.toFixed(2) }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup>
defineProps({ stats: { type: Array, default: () => [] } })
</script>

<style scoped>
table {
    border-collapse: collapse
}

th,
td {
    border: 1px solid #e6e9ef
}
</style>
