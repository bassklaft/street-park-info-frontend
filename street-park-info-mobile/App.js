import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Keyboard, Alert, Animated } from 'react-native';
import * as Location from 'expo-location';

const API = 'https://street-park-info-backend.onrender.com';
const Y = '#F7C948';
const R = '#E53E3E';
const G = '#38A169';
const W = '#EDEBE4';
const M = '#555';

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('home'); // home | loading | ambiguous | results
  const [result, setResult] = useState(null);
  const [ambiguous, setAmbiguous] = useState(null);
  const [cleaning, setCleaning] = useState([]);
  const [error, setError] = useState(null);

  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

  const fetchCleaningForStreets = async (streets, lat, lng) => {
    const results = await Promise.all(streets.map(async s => {
      try {
        const p = new URLSearchParams({ street: s });
        if (lat && lng) { p.set('lat', lat); p.set('lng', lng); }
        const r = await fetch(`${API}/api/cleaning?${p}`);
        const data = r.ok ? await r.json() : [];
        return data.map(c => ({ ...c, street: s }));
      } catch { return []; }
    }));
    return results.flat();
  };

  const loadLocation = async (loc) => {
    const streets =
      loc.isPark && loc.parkStreets?.length ? loc.parkStreets :
      (loc.isZip || loc.isNeighborhood) && loc.zipStreets?.length ? loc.zipStreets :
      loc.isGPS && loc.nearbyStreets?.length ? loc.nearbyStreets :
      [loc.street];
    const data = await fetchCleaningForStreets(streets, loc.lat, loc.lng);
    setResult(loc);
    setCleaning(data);
    setPhase('results');
  };

  const search = async (q) => {
    const sq = (q || query).trim();
    if (!sq) return;
    Keyboard.dismiss();
    setLoading(true); setError(null); setResult(null); setCleaning([]); setAmbiguous(null); setPhase('loading');
    try {
      const r = await fetch(`${API}/api/geocode?q=${encodeURIComponent(sq)}`);
      const loc = await r.json();
      if (!r.ok) throw new Error(loc.error || 'Not found');
      if (loc.type === 'ambiguous') { setAmbiguous(loc); setPhase('ambiguous'); return; }
      await loadLocation(loc);
    } catch(e) { setError(e.message); setPhase('home'); }
    finally { setLoading(false); }
  };

  const handleGPS = async () => {
    setLoading(true); setError(null); setResult(null); setCleaning([]); setAmbiguous(null); setPhase('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Location Required', 'Please enable location in Settings.'); setPhase('home'); setLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = loc.coords;
      const r = await fetch(`${API}/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await r.json();
      if (!r.ok) throw new Error('Could not identify your street');
      await loadLocation({ ...data, lat, lng });
    } catch(e) { setError(e.message); setPhase('home'); }
    finally { setLoading(false); }
  };

  const pickOption = async (opt) => {
    setPhase('loading'); setLoading(true);
    try {
      if (opt.type === 'neighborhood' || !opt.zipStreets?.length) {
        const clean = opt.label.replace(/,\s*(Brooklyn|Manhattan|Queens|Bronx|Staten Island|Chicago|Los Angeles|San Francisco|Boston|Philadelphia|Seattle|Washington DC)$/i, '').trim();
        const r = await fetch(`${API}/api/geocode?q=${encodeURIComponent(clean)}`);
        const full = await r.json();
        await loadLocation(full);
      } else { await loadLocation(opt); }
    } catch(e) { setError(e.message); setPhase('home'); }
    finally { setLoading(false); }
  };

  const goHome = () => { setPhase('home'); setResult(null); setCleaning([]); setAmbiguous(null); setQuery(''); setError(null); };
  const isMulti = result?.isPark || result?.isZip || result?.isNeighborhood || result?.isGPS;
  const groupByCategory = (options) => options.reduce((acc, opt) => { const cat = opt.category || 'Other'; if (!acc[cat]) acc[cat] = []; acc[cat].push(opt); return acc; }, {});

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />

      {/* NAV */}
      <View style={s.nav}>
        <TouchableOpacity onPress={goHome}><Text style={s.logo}>STREET PARK <Text style={{color:W}}>INFO</Text></Text></TouchableOpacity>
        <TouchableOpacity style={s.homeBtn} onPress={goHome}><Text style={s.homeBtnText}>⌂ HOME</Text></TouchableOpacity>
        <View style={s.pill}><Text style={s.pillText}>NYC+</Text></View>
      </View>

      {/* HOME */}
      {phase === 'home' && (
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="always">
          {/* HERO */}
          <Text style={s.eyebrow}>😤 Tired of expensive parking tickets?</Text>
          <Text style={s.h1}>KNOW{'\n'}BEFORE{'\n'}<Text style={{color:Y}}>YOU PARK.</Text></Text>

          {/* TICKET STAT */}
          <View style={s.statBox}>
            <Text style={s.statNum}>16,092,421</Text>
            <Text style={s.statLabel}>parking tickets issued in NYC last year · avg. <Text style={{color:W,fontWeight:'700'}}>$65</Text> each · totaling over <Text style={{color:W,fontWeight:'700'}}>$1 billion</Text></Text>
          </View>

          <Text style={s.sub}>Street cleaning · Film shoots · Events · Weather</Text>
          <Text style={s.cities}>NYC · LA · Chicago · SF · Boston · Philly · DC · Seattle</Text>

          {/* SEARCH */}
          <View style={s.searchRow}>
            <TextInput style={s.input} placeholder="Broadway, Wicker Park, WeHo, 90210…" placeholderTextColor="#444" value={query} onChangeText={setQuery} onSubmitEditing={() => search()} returnKeyType="search" autoCapitalize="none" />
            <TouchableOpacity style={s.searchBtn} onPress={() => search()} disabled={loading}>
              <Text style={s.searchBtnText}>GO</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.gpsBtn} onPress={handleGPS}>
            <Text style={s.gpsBtnText}>📍  Use My Current Location</Text>
          </TouchableOpacity>

          {error && <Text style={s.err}>⚠ {error}</Text>}

          {/* MOVE YOUR CAR BANNER */}
          <View style={s.moveCarBanner}>
            <View style={s.moveCarBadge}><Text style={s.moveCarBadgeText}>COMING SOON</Text></View>
            <Text style={s.moveCarTitle}>🚗 WE'LL MOVE YOUR CAR</Text>
            <Text style={s.moveCarSub}>Can't move your car in time? We'll send a trusted driver to move it for you. Available for vehicles with smart key access · Safe, insured, background-checked drivers.</Text>
            <TouchableOpacity style={s.moveCarCta}><Text style={s.moveCarCtaText}>Join the waitlist →</Text></TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* LOADING */}
      {phase === 'loading' && (
        <View style={s.center}>
          <ActivityIndicator color={Y} size="large" />
          <Text style={s.loadingText}>Scanning databases…</Text>
        </View>
      )}

      {/* AMBIGUOUS */}
      {phase === 'ambiguous' && ambiguous && (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.ambigTitle}>Did you mean…</Text>
          <Text style={s.ambigSub}>"{ambiguous.label}" could mean a few things:</Text>
          {Object.entries(groupByCategory(ambiguous.options)).map(([cat, opts]) => (
            <View key={cat}>
              <Text style={s.ambigCat}>{cat}</Text>
              {opts.map((opt, i) => (
                <TouchableOpacity key={i} style={s.ambigOpt} onPress={() => pickOption(opt)}>
                  <View style={{flex:1}}>
                    <Text style={s.ambigOptLabel}>{opt.label}</Text>
                    <Text style={s.ambigOptMeta}>{opt.borough}{opt.neighborhood ? ` · ${opt.neighborhood}` : ''}</Text>
                  </View>
                  <Text style={{color:M,fontSize:18}}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <TouchableOpacity style={s.backBtn} onPress={goHome}><Text style={s.backBtnText}>← Back</Text></TouchableOpacity>
        </ScrollView>
      )}

      {/* RESULTS */}
      {phase === 'results' && result && (
        <ScrollView contentContainerStyle={s.scroll}>
          {/* Location card */}
          <View style={s.locCard}>
            <Text style={s.locEye}>📍 {result.isGPS ? 'YOUR LOCATION' : 'SEARCH RESULT'}</Text>
            <Text style={s.locName}>{result.label || result.street}</Text>
            <Text style={s.locMeta}>{[result.neighborhood, result.borough, result.city].filter(Boolean).join(' · ')}</Text>
            {isMulti && <Text style={s.locSub}>{result.isGPS ? 'Nearby streets · closest first' : `${cleaning.length} streets`}</Text>}
          </View>

          {/* Cleaning cards */}
          {cleaning.length === 0 && <Text style={s.empty}>No cleaning regulations found.</Text>}
          {cleaning.map((c, i) => (
            <View key={i} style={[s.cleanCard, c.days?.includes(today) && s.cleanCardToday]}>
              {c.days?.includes(today) && <Text style={s.todayBadge}>⚠ CLEANING TODAY</Text>}
              {isMulti && c.street && <Text style={s.streetLbl}>{c.street}</Text>}
              {c.side && <Text style={s.sideLbl}>{c.side === 'L' ? 'Left / Even' : c.side === 'R' ? 'Right / Odd' : c.side}</Text>}
              <View style={s.chips}>
                {DAYS.map(d => <Text key={d} style={[s.chip, c.days?.includes(d) && s.chipOn]}>{d}</Text>)}
              </View>
              {c.time && <Text style={s.cleanTime}>{c.time}</Text>}
              {c.upcomingDates?.length > 0 && (
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:4,marginTop:6}}>
                  {c.upcomingDates.map((d,di) => (
                    <Text key={di} style={[s.dateChip, di===0&&c.days?.includes(today)&&s.dateChipToday]}>{d}</Text>
                  ))}
                </View>
              )}
              <Text style={s.cleanRaw}>{c.raw}</Text>
            </View>
          ))}

          <TouchableOpacity style={s.backBtn} onPress={goHome}><Text style={s.backBtnText}>← New Search</Text></TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#080808'},
  scroll:{padding:20,paddingBottom:60},
  // NAV
  nav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:12,borderBottomWidth:2,borderBottomColor:Y,position:'relative'},
  logo:{fontSize:18,color:Y,fontWeight:'800',letterSpacing:1},
  homeBtn:{position:'absolute',left:'50%',transform:[{translateX:-30}],borderWidth:1,borderColor:'#333',paddingHorizontal:10,paddingVertical:4},
  homeBtnText:{color:'#888',fontSize:11,fontFamily:'monospace'},
  pill:{backgroundColor:Y,paddingHorizontal:8,paddingVertical:3},
  pillText:{color:'#000',fontSize:10,fontWeight:'700',letterSpacing:1},
  // HOME
  eyebrow:{color:Y,fontSize:12,letterSpacing:1,marginBottom:8,marginTop:8,fontFamily:'monospace'},
  h1:{fontSize:48,color:W,fontWeight:'800',lineHeight:52,marginBottom:20},
  statBox:{backgroundColor:'#1e1e1e',borderLeftWidth:3,borderLeftColor:R,padding:14,marginBottom:16},
  statNum:{fontSize:32,color:R,fontWeight:'800',letterSpacing:1},
  statLabel:{fontSize:11,color:M,lineHeight:18,marginTop:4,fontFamily:'monospace'},
  sub:{fontSize:13,color:'#666',marginBottom:4,fontFamily:'monospace'},
  cities:{fontSize:11,color:Y,marginBottom:20,fontFamily:'monospace',letterSpacing:1},
  searchRow:{flexDirection:'row',borderWidth:2,borderColor:Y,marginBottom:10,backgroundColor:'#1e1e1e'},
  input:{flex:1,color:W,fontSize:15,padding:14},
  searchBtn:{backgroundColor:Y,justifyContent:'center',alignItems:'center',paddingHorizontal:22},
  searchBtnText:{fontSize:18,fontWeight:'800',color:'#000'},
  gpsBtn:{borderWidth:1,borderColor:'#2a2a2a',padding:13,alignItems:'center',marginBottom:20,borderRadius:6},
  gpsBtnText:{fontSize:13,color:'#888'},
  err:{color:R,fontSize:13,marginBottom:12,fontFamily:'monospace'},
  // MOVE CAR
  moveCarBanner:{backgroundColor:'#0a0a1a',borderWidth:1,borderColor:'#3a3a6a',padding:18,marginTop:8,position:'relative'},
  moveCarBadge:{position:'absolute',top:0,right:0,backgroundColor:'#3a3a6a',paddingHorizontal:10,paddingVertical:3},
  moveCarBadgeText:{color:'#aaaaff',fontSize:9,letterSpacing:2,fontFamily:'monospace'},
  moveCarTitle:{fontSize:22,color:'#aaaaff',fontWeight:'800',marginBottom:8,marginTop:8},
  moveCarSub:{fontSize:12,color:'#555',lineHeight:18,fontFamily:'monospace'},
  moveCarCta:{marginTop:12},
  moveCarCtaText:{color:'#aaaaff',fontSize:13,fontFamily:'monospace'},
  // LOADING
  center:{flex:1,alignItems:'center',justifyContent:'center',gap:16},
  loadingText:{color:Y,fontSize:12,letterSpacing:2,fontFamily:'monospace'},
  // AMBIGUOUS
  ambigTitle:{fontSize:28,color:W,fontWeight:'800',marginBottom:6,marginTop:8},
  ambigSub:{fontSize:12,color:'#666',marginBottom:16,fontFamily:'monospace'},
  ambigCat:{fontSize:10,color:Y,letterSpacing:2,marginBottom:6,marginTop:16,fontFamily:'monospace'},
  ambigOpt:{flexDirection:'row',alignItems:'center',backgroundColor:'#1e1e1e',borderWidth:1,borderColor:'#2a2a2a',padding:14,marginBottom:6,borderRadius:6},
  ambigOptLabel:{fontSize:16,color:W,fontWeight:'600',marginBottom:2},
  ambigOptMeta:{fontSize:11,color:'#666'},
  // RESULTS
  locCard:{backgroundColor:'#1e1e1e',borderWidth:1,borderColor:'#2a2a2a',padding:16,marginBottom:12,borderRadius:8},
  locEye:{fontSize:10,color:Y,letterSpacing:2,marginBottom:4,fontFamily:'monospace'},
  locName:{fontSize:24,color:W,fontWeight:'800',marginBottom:4},
  locMeta:{fontSize:12,color:'#666',fontFamily:'monospace'},
  locSub:{fontSize:11,color:Y,marginTop:4,fontFamily:'monospace'},
  cleanCard:{backgroundColor:'#1e1e1e',borderWidth:1,borderColor:'#222',padding:14,marginBottom:8,borderRadius:8},
  cleanCardToday:{borderColor:R,backgroundColor:'#120808'},
  todayBadge:{fontSize:10,color:R,letterSpacing:2,marginBottom:8,fontFamily:'monospace'},
  streetLbl:{fontSize:10,color:Y,letterSpacing:2,marginBottom:4,fontFamily:'monospace'},
  sideLbl:{fontSize:11,color:'#666',marginBottom:6,fontFamily:'monospace'},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:4,marginBottom:8},
  chip:{fontSize:11,paddingHorizontal:8,paddingVertical:3,borderWidth:1,borderColor:'#2a2a2a',color:'#555',borderRadius:4,fontFamily:'monospace'},
  chipOn:{backgroundColor:Y,borderColor:Y,color:'#000',fontWeight:'700'},
  cleanTime:{fontSize:26,color:W,fontWeight:'800',marginBottom:4},
  dateChip:{fontSize:10,paddingHorizontal:7,paddingVertical:2,backgroundColor:'#141414',borderWidth:1,borderColor:'#2a2a2a',color:'#666',borderRadius:3,fontFamily:'monospace'},
  dateChipToday:{backgroundColor:R,borderColor:R,color:'#fff'},
  cleanRaw:{fontSize:11,color:'#444',lineHeight:16,marginTop:4,fontFamily:'monospace'},
  empty:{fontSize:13,color:'#444',marginTop:8,fontFamily:'monospace'},
  backBtn:{marginTop:24,padding:14,borderWidth:1,borderColor:'#2a2a2a',alignItems:'center',borderRadius:8},
  backBtnText:{fontSize:13,color:'#666',fontFamily:'monospace'},
});
