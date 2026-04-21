import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Keyboard } from 'react-native';

const API = 'https://street-park-info-backend.onrender.com';

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [ambiguous, setAmbiguous] = useState(null);
  const [cleaning, setCleaning] = useState([]);
  const [error, setError] = useState(null);

  const search = async (q) => {
    const searchQuery = (q || query).trim();
    if (!searchQuery) return;
    Keyboard.dismiss();
    setLoading(true); setError(null); setResult(null); setCleaning([]); setAmbiguous(null);
    try {
      const r = await fetch(`${API}/api/geocode?q=${encodeURIComponent(searchQuery)}`);
      const loc = await r.json();
      if (!r.ok) throw new Error(loc.error || 'Not found');
      if (loc.type === 'ambiguous') { setAmbiguous(loc); setLoading(false); return; }
      setResult(loc);
      const cr = await fetch(`${API}/api/cleaning?street=${encodeURIComponent(loc.street)}&lat=${loc.lat}&lng=${loc.lng}`);
      setCleaning(await cr.json());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const pickOption = (opt) => {
    setAmbiguous(null);
    setResult(opt);
    fetch(`${API}/api/cleaning?street=${encodeURIComponent(opt.street)}&lat=${opt.lat}&lng=${opt.lng}`)
      .then(r => r.json()).then(setCleaning).catch(() => setCleaning([]));
  };

  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
  const groupByCategory = (options) => options.reduce((acc, opt) => { const cat = opt.category || 'Other'; if (!acc[cat]) acc[cat] = []; acc[cat].push(opt); return acc; }, {});

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="always">
        <Text style={s.logo}>STREET PARK <Text style={s.accent}>INFO</Text></Text>
        {!result && !ambiguous && <Text style={s.tagline}>KNOW BEFORE{'\n'}YOU PARK.</Text>}
        <View style={s.row}>
          <TextInput style={s.input} placeholder="Broadway, Chelsea, intrepid, 11211…" placeholderTextColor="#555" value={query} onChangeText={setQuery} onSubmitEditing={() => search()} returnKeyType="search" autoCapitalize="none" />
          <TouchableOpacity style={s.btn} onPress={() => search()} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>GO</Text>}
          </TouchableOpacity>
        </View>
        {error && <Text style={s.err}>⚠ {error}</Text>}
        {ambiguous && (
          <View>
            <Text style={s.ambigTitle}>Did you mean…</Text>
            <Text style={s.ambigSub}>"{ambiguous.label}" could refer to a few things. Pick one:</Text>
            {Object.entries(groupByCategory(ambiguous.options)).map(([cat, opts]) => (
              <View key={cat}>
                <Text style={s.ambigCat}>{cat}</Text>
                {opts.map((opt, i) => (
                  <TouchableOpacity key={i} style={s.ambigOption} onPress={() => pickOption(opt)}>
                    <View style={{flex:1}}>
                      <Text style={s.ambigLabel}>{opt.label}</Text>
                      <Text style={s.ambigMeta}>{opt.borough}{opt.neighborhood ? ` · ${opt.neighborhood}` : ''}</Text>
                    </View>
                    <Text style={s.ambigArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}
        {result && (
          <View style={s.card}>
            <Text style={s.cardEye}>📍 YOUR LOCATION</Text>
            <Text style={s.cardName}>{result.label || result.street}</Text>
            <Text style={s.cardMeta}>{[result.neighborhood, result.borough].filter(Boolean).join(' · ')}</Text>
          </View>
        )}
        {cleaning.map((c, i) => (
          <View key={i} style={[s.cleanCard, c.days?.includes(today) && s.cleanToday]}>
            {c.days?.includes(today) && <Text style={s.todayBadge}>⚠ CLEANING TODAY</Text>}
            <View style={s.chips}>{DAYS.map(d => <Text key={d} style={[s.chip, c.days?.includes(d) && s.chipOn]}>{d}</Text>)}</View>
            {c.time && <Text style={s.cleanTime}>{c.time}</Text>}
            <Text style={s.cleanRaw}>{c.raw}</Text>
          </View>
        ))}
        {result && cleaning.length === 0 && !loading && <Text style={s.empty}>No cleaning regulations found for this block.</Text>}
        {(result || ambiguous) && (
          <TouchableOpacity style={s.newSearch} onPress={() => { setResult(null); setCleaning([]); setAmbiguous(null); setQuery(''); }}>
            <Text style={s.newSearchText}>← New Search</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex:1, backgroundColor:'#080808' },
  scroll: { padding:24, paddingBottom:60 },
  logo: { fontSize:22, color:'#F7C948', fontWeight:'700', letterSpacing:1, marginBottom:4, marginTop:8 },
  accent: { color:'#EDEBE4' },
  tagline: { fontSize:40, color:'#EDEBE4', fontWeight:'700', marginBottom:32, lineHeight:44 },
  row: { flexDirection:'row', borderWidth:2, borderColor:'#F7C948', marginBottom:16, backgroundColor:'#1e1e1e' },
  input: { flex:1, color:'#EDEBE4', fontSize:15, padding:14 },
  btn: { backgroundColor:'#F7C948', justifyContent:'center', alignItems:'center', paddingHorizontal:20 },
  btnText: { fontSize:18, fontWeight:'700', color:'#000' },
  err: { color:'#E53E3E', fontSize:13, marginBottom:12 },
  ambigTitle: { fontSize:26, color:'#EDEBE4', fontWeight:'700', marginBottom:6 },
  ambigSub: { fontSize:12, color:'#666', marginBottom:16, lineHeight:18 },
  ambigCat: { fontSize:10, color:'#F7C948', letterSpacing:2, textTransform:'uppercase', marginBottom:6, marginTop:16 },
  ambigOption: { flexDirection:'row', alignItems:'center', backgroundColor:'#1e1e1e', borderWidth:1, borderColor:'#2a2a2a', padding:14, marginBottom:6, borderRadius:6 },
  ambigLabel: { fontSize:16, color:'#EDEBE4', fontWeight:'600', marginBottom:2 },
  ambigMeta: { fontSize:11, color:'#666' },
  ambigArrow: { fontSize:16, color:'#555', marginLeft:8 },
  card: { backgroundColor:'#1e1e1e', borderWidth:1, borderColor:'#2a2a2a', padding:16, marginBottom:12, borderRadius:8 },
  cardEye: { fontSize:10, color:'#F7C948', letterSpacing:2, marginBottom:4 },
  cardName: { fontSize:22, color:'#EDEBE4', fontWeight:'700', marginBottom:4 },
  cardMeta: { fontSize:12, color:'#666' },
  cleanCard: { backgroundColor:'#1e1e1e', borderWidth:1, borderColor:'#222', padding:14, marginBottom:8, borderRadius:8 },
  cleanToday: { borderColor:'#E53E3E', backgroundColor:'#120808' },
  todayBadge: { fontSize:10, color:'#E53E3E', letterSpacing:2, marginBottom:8 },
  chips: { flexDirection:'row', flexWrap:'wrap', gap:4, marginBottom:8 },
  chip: { fontSize:11, paddingHorizontal:8, paddingVertical:3, borderWidth:1, borderColor:'#2a2a2a', color:'#555', borderRadius:4 },
  chipOn: { backgroundColor:'#F7C948', borderColor:'#F7C948', color:'#000' },
  cleanTime: { fontSize:22, color:'#EDEBE4', fontWeight:'700', marginBottom:4 },
  cleanRaw: { fontSize:11, color:'#444', lineHeight:16 },
  empty: { fontSize:13, color:'#444', marginTop:8 },
  newSearch: { marginTop:24, padding:14, borderWidth:1, borderColor:'#2a2a2a', alignItems:'center', borderRadius:8 },
  newSearchText: { fontSize:13, color:'#666' },
});
